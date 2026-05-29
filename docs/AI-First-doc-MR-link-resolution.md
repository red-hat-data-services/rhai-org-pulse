# MR Link Resolution — Design Principle

Documentation MR links on the Documentation view are resolved using three
strategies, applied in sequence with deduplication. No single source is
reliable on its own because the external `doc-creator` tool writes
`customfield_10875` ("Git Pull Request") to multiple Jira issues but the
write can fail silently on read-only issue types.

## Strategies

### 1. CCS Tree (`resolveMRLinksFromCcsTree`)

RHAISTRAT → CCS/DOCS epic child → child tasks with `ai1st-doc-contributed`
→ `customfield_10875`.

Original strategy. Works when the doc-creator successfully populates the
custom field on the CCS task hierarchy.

### 2. Direct field on invoked issue (`resolveMRLinksFromInvokedField`)

Issues with the `ai1st-doc-invoked` label often have `customfield_10875`
written directly by the doc-creator script on the RHAISTRAT itself. This
bypasses the CCS tree entirely.

### 3. MR title cross-reference (`resolveMRLinksFromKpiData`)

Parses Jira keys (`RHAISTRAT-xxx`, `RHOAIENG-xxx`) from GitLab MR titles
in the MR KPI dataset. The MR KPI data is fetched separately from GitLab
using the `ai1st-jira-contributed` label — no Jira custom field dependency
at all.

## Implementation

All three strategies append to `issue.mrLinks[]` with deduplication via
`addMrLink()`. The orchestrator function `resolveMRLinks()` in
`server/jira/doc-fetcher.js` runs them in order.

The MR KPI data is fetched before doc data during refresh so it's available
for strategy 3. See `server/index.js` refresh handler and
`server/gitlab/mr-kpi-fetcher.js`.
