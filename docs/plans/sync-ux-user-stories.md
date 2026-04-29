# Sync UX Improvement — User Stories

## Background

The Team Tracker module has two separate sync processes for org/team/people structure:

1. **Roster Sync** — LDAP people + Google Sheets enrichment → `org-roster-full.json`
2. **Org Metadata Sync** — Google Sheets team boards + components, org name mapping → `org-roster/teams-metadata.json`, `org-roster/components.json`

These are configured across two different settings tabs (Roster Sync, Team Structure) with inconsistent sync controls. The org metadata sync has no UI trigger at all. This creates confusion about what to configure where and how to make changes take effect.

**Scope**: Only the org/team/people structure syncs. Jira metrics, GitHub/GitLab contribution history, and other data refreshes are out of scope.

---

## User Stories

### US-1: Unified sync action for org/team/people structure

**As an admin, I want to sync all org/team/people structure data with one action so I don't have to know which internal sync process to trigger.**

**Acceptance criteria:**
- A single "Sync" button that runs both the roster sync (LDAP + Sheets people data) and the org metadata sync (team boards, components, org name mapping) in sequence
- Clear progress/status feedback while syncing (e.g., "Syncing people... Syncing teams...")
- Success/error result shown when complete
- Individual syncs can still run independently if needed (the unified action is additive, not a replacement)

---

### US-2: Banner prompting sync after config changes

**As an admin, after saving configuration changes that affect the team directory (e.g., org name mappings, org roots, sheet column mappings), I want to see a banner letting me know a sync is needed so my changes take effect.**

**Acceptance criteria:**
- After saving settings in Roster Sync or Team Structure tabs, a banner appears: something like "Configuration saved. Sync needed for changes to take effect." with a "Sync Now" action
- Banner is dismissible
- Banner clears automatically after a successful sync

---

### US-3: Unified sync status across data sources

**As an admin, I want to see sync status for all org/team/people data sources in one place so I know if data is fresh.**

**Acceptance criteria:**
- Shows last sync time for both roster sync and org metadata sync
- Indicates if either is stale or has never run
- Visible from the settings UI (doesn't require navigating to separate tabs to piece together status)

---

### US-4: Clear settings tab organization

**As an admin, I want to understand what each settings tab controls so I configure the right thing.**

**Acceptance criteria:**
- The relationship between "Roster Sync" (people) and "Team Structure" (teams/orgs from Sheets) is clear
- Each tab has a brief description of what it configures and what data it affects
- Consider whether the current tab split (Roster Sync vs Team Structure) is the right boundary, or if they should be consolidated/renamed

---

## Out of Scope

- Jira metrics refresh (person metrics, sprint data)
- GitHub/GitLab contribution history refresh
- Trend data refresh
- Sync error diagnostics / skip reporting (future improvement)
