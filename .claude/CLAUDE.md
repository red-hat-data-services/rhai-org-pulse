# AI Platform Team Tracker

## Architecture

- **Frontend**: Vue 3 SPA with Composition API (`<script setup>`), Vite 6, Tailwind CSS 3
- **Backend**: Express API server (port 3001) for local dev, AWS Lambda in production
- **Charts**: Chart.js 4 + vue-chartjs 5
- **Auth**: Firebase Google OAuth (restricted to @redhat.com)
- **Storage**: Local filesystem (`./data/`) in dev, S3 (`acorvin-team-tracker-data-prod`) in production
- **Hosting**: AWS Amplify (auto-deploys frontend on git push to main)

## Key Concepts

### Data Flow
- **Roster**: `data/org-roster-full.json` defines all orgs, teams, and members. The `deriveRoster()` function transforms this into the API response format.
- **Person metrics**: Individual Jira stats stored as `data/people/{name}.json`. Fetched via JQL queries against Jira with 365-day lookback.
- **GitHub contributions**: `data/github-contributions.json` stores contribution counts per user. `data/github-history.json` stores monthly history.
- **Trends**: Built dynamically from person metric files by bucketing resolved issues by month, with org/team breakdowns.
- **Composite keys**: Teams are identified by `orgKey::teamName` (e.g., `shgriffi::Model Serving`).

### Three Copies of person-metrics.js
The Jira metrics logic exists in three places that must be kept in sync:
1. `server/jira/person-metrics.js` — local dev server
2. `amplify/backend/function/teamTrackerReader/src/person-metrics.js` — Lambda reader
3. `amplify/backend/function/teamTrackerRefresher/src/person-metrics.js` — Lambda refresher

### Jira Integration (Jira Cloud — redhat.atlassian.net)
- Auth: Basic auth with `JIRA_EMAIL` + `JIRA_TOKEN` (API token), base64-encoded
- Uses the Sprint Report API (`/rest/greenhopper/1.0/rapid/charts/sprintreport`) for sprint data (committed vs delivered)
- Uses `/rest/api/3/search/jql` (GET with cursor-based `nextPageToken` pagination) for person-level metrics
- Auto-resolves roster display names to Jira Cloud accountIds via `/rest/api/2/user/search?query=`, cached in `data/jira-name-map.json` (format: `{ "Name": { accountId, displayName } }`)
- JQL uses `assignee = "accountId"` (not display names)
- Story points field: `customfield_10028`
- Searches across all Jira projects (no project filter)

### Caching
- Frontend uses localStorage stale-while-revalidate pattern (prefix `tt_cache:`)
- API functions accept an `onData` callback: called immediately with cached data, then again with fresh data

## Deployment

There are three separate deployment targets:

| What | How | When |
|------|-----|------|
| Frontend (Vue SPA) | `git push` to main | Amplify auto-builds and deploys |
| Lambda functions + API Gateway | `amplify push --yes` (use `--force` if no changes detected) | After modifying Lambda code or API routes |
| Data files | `aws s3 sync data/ s3://acorvin-team-tracker-data-prod/` | After modifying roster or data files |

All AWS CLI commands require the SAML login prefix:
```
rh-aws-saml-login iaps-rhods-odh-dev/585132637328-rhoai-dev -- <command>
```

Amplify app ID: `d3ofiswnhr3rov`

## Commands

- `npm run dev:full` — start both Vite and Express servers
- `npm run dev` — Vite only (frontend)
- `npm run dev:server` — Express only (backend, requires JIRA_EMAIL and JIRA_TOKEN in .env)
- `npm test` — run all tests
- `npm run test:watch` — run tests in watch mode

## Project Structure

```
src/
  components/       # 35 Vue components (App.vue is the root with hash routing)
  composables/      # Shared state (useRoster, useAuth, useGithubStats, useAllowlist, useViewPreference)
  services/api.js   # API client with auth + caching
  utils/metrics.js  # Metric calculations
  config/firebase.js
  __tests__/        # Frontend tests

server/
  dev-server.js     # Express server for local dev (combines reader + refresher)
  storage.js        # Local file storage abstraction
  jira/             # Jira API integration (client, sprint-report, person-metrics, orchestration)
  github/           # GitHub contribution fetching
  jira/__tests__/   # Backend tests

amplify/backend/function/
  teamTrackerReader/    # Lambda: serves data from S3 (GET endpoints)
  teamTrackerRefresher/ # Lambda: fetches fresh data from Jira (POST refresh endpoints)

amplify/backend/api/teamTrackerApi/
  cli-inputs.json   # API Gateway route definitions

scripts/            # Utility scripts for roster building and data management
data/               # Local dev data (gitignored)
```

## Code Style

- Use `<script setup>` for new Vue components
- CommonJS (`require`) for server-side code (Lambda + Express)
- ES modules (`import`) for frontend code
- No TypeScript — plain JavaScript throughout
- Prefer composables (`src/composables/`) for shared state logic
- Tailwind utility classes for styling; custom `primary` color palette defined in tailwind.config.mjs

## Testing

- Vitest + @vue/test-utils for frontend tests in `src/__tests__/`
- Vitest for backend unit tests in `server/jira/__tests__/`
- Run `npm test` before committing

## API Routes

All routes are authenticated via Firebase ID token in the Authorization header.

**GET (Reader Lambda):**
- `/roster` — org/team structure with members
- `/team/:teamKey/metrics` — team member metrics (teamKey = `orgKey::teamName`)
- `/person/:name/metrics` — individual person metrics
- `/people/metrics` — bulk all-people metrics
- `/github/contributions` — GitHub contribution data
- `/trends` — monthly Jira + GitHub trend data
- `/allowlist` — authorized email list

**POST (Refresher Lambda):**
- `/roster/refresh` — refresh all person metrics from Jira
- `/team/:teamKey/refresh` — refresh metrics for one team
- `/person/:name/metrics?refresh=true` — refresh single person
- `/github/refresh` — refresh all GitHub contributions
- `/github/contributions/:username/refresh` — refresh single user
- `/trends/jira/refresh` — refresh Jira trends
- `/trends/github/refresh` — refresh GitHub history
