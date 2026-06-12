# Safe Non-Demo Mode Setup

You now have a safe non-demo environment configured! 🎉

## What's Different

- **Storage**: Reads/writes to `./data/` instead of `./fixtures/`
- **No write credentials**: Jira/LDAP tokens are commented out
- **Empty state**: Minimal stub files created to prevent crashes
- **You're an admin**: `ankristo@redhat.com` is pre-configured

## How to Run

```bash
npm run dev:full
```

Visit http://localhost:5173

## What You'll See

### Empty States (Safe to Explore)
- **Team Tracker**: No teams, empty roster
- **AI Impact**: No assessments
- **Releases**: No execution data
- **Upstream Pulse**: No contributions
- **System Health**: No health checks
- **Customer Insights**: Should show your existing data from `data/customer-insights/`

### What Works
✅ Navigation between modules  
✅ Settings UI (but no integrations configured)  
✅ Customer Insights (has data)  
✅ UI/UX exploration  
✅ File watching and writes to `./data/`

### What's Disabled (For Safety)
❌ Jira RFE creation (no credentials)  
❌ Roster sync (no LDAP credentials)  
❌ GitHub/GitLab data fetch (no tokens)  
❌ Metrics refresh (no Jira credentials)

## Next Steps: Adding Read-Only Data (Optional)

If you want to see the app populated with real data **without write risk**:

### 1. Add GitHub Token (Read-Only)
```bash
# Add to .env.local:
GITHUB_TOKEN=ghp_yourtoken  # Classic PAT with only read:user scope
```

### 2. Add GitLab Token (Read-Only)
```bash
# Add to .env.local:
GITLAB_TOKEN=glpat-yourtoken  # PAT with only read_api scope
```

### 3. Add Jira Token (Read-Only Risk: LOW)
```bash
# Add to .env.local:
JIRA_EMAIL=ankristo@redhat.com
JIRA_TOKEN=your-token-here
```
⚠️ **Note**: Jira tokens can create issues. Only add this if:
- You understand the risk
- You'll avoid clicking "Create RFE" in Customer Insights
- Or you want to test the full workflow in a sandbox Jira project

### 4. Trigger Data Fetch
Once you have read tokens configured:
1. Go to Settings
2. Click "Refresh All Metrics"
3. Wait for data to populate in `./data/`

## Switching Back to Demo Mode

Edit `.env.local`:
```bash
DEMO_MODE=true
VITE_DEMO_MODE=true
```

Or just delete `.env.local` (it overrides `.env`).

## Files Created

- `.env.local` — Safe environment config (overrides `.env`)
- `data/org-roster-full.json` — Empty roster
- `data/team-data/registry.json` — Empty team registry
- `data/github-contributions.json` — Empty GitHub data
- `data/gitlab-contributions.json` — Empty GitLab data
- `data/roles.json` — You as admin
- `data/site-config.json` — Basic site config
- `data/messages.json` — Empty announcements

## Gitignore Note

`.env.local` and `data/` are both gitignored, so your credentials and local data won't be committed.
