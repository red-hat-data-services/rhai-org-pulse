# AI Engineering People & Teams

Internal dashboard for tracking AI Platform engineering team productivity across Jira and GitHub.

## Quick Start (Demo Mode)

Run the app with sample data — no credentials needed:

```bash
npm install

echo "DEMO_MODE=true" > .env
echo "VITE_DEMO_MODE=true" >> .env

npm run dev:full
```

Open http://localhost:5173.

## Quick Start (Full Setup)

For real Jira and GitHub data:

### Prerequisites

- Node.js 18+
- Red Hat VPN (required for LDAP roster sync)
- @redhat.com Google account

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Required
JIRA_EMAIL=you@redhat.com
JIRA_TOKEN=your-jira-api-token        # From https://id.atlassian.com/manage-profile/security/api-tokens
ADMIN_EMAILS=you@redhat.com

# Optional — GitHub contribution stats
GITHUB_TOKEN=your-github-classic-pat   # Classic PAT with read:user scope

# Optional — automated roster sync from Google Sheets
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./secrets/google-sa-key.json
```

**Jira API Token:** Go to https://id.atlassian.com/manage-profile/security/api-tokens, click "Create API token", and paste the value as `JIRA_TOKEN`.

**GitHub Token:** Create a **classic** Personal Access Token (not fine-grained — GraphQL API doesn't support those yet) at https://github.com/settings/tokens with the `read:user` scope.

**Google Service Account** (for roster sync): See [Google Service Account Setup](#google-service-account-setup) below.

### 3. Start dev servers

```bash
npm run dev:full
```

This starts both the Vite frontend (port 5173) and the Express backend (port 3001). Vite proxies `/api` requests to the backend.

- **Frontend:** http://localhost:5173
- **API:** http://localhost:3001/api

### 4. Configure roster sync (first run)

On first launch, a yellow banner will appear directing you to **Settings**. There you can configure:

- **Org roots** — LDAP UIDs of org leaders whose teams you want to track (e.g., `shgriffi`)
- **Google Sheet ID** — The spreadsheet ID from the Google Sheets URL (the long alphanumeric string). Sheet names are auto-discovered.

Click "Sync Now" to populate the roster. The app will also sync automatically once every 24 hours.

## Google Service Account Setup

To use the Google Sheets roster sync:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable the **Google Sheets API** (APIs & Services > Library)
4. Create a **Service Account** (APIs & Services > Credentials > Create Credentials)
5. Create a JSON key for the service account and download it
6. Place the key file at `secrets/google-sa-key.json` (this path is gitignored)
7. Set `GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./secrets/google-sa-key.json` in `.env`
8. Share your Google Sheet with the service account email (the `client_email` in the JSON key)

## Commands

```bash
npm run dev:full     # Start frontend + backend
npm run dev          # Frontend only (Vite)
npm run dev:server   # Backend only (Express, needs .env)
npm test             # Run all tests
npm run test:watch   # Tests in watch mode
npm run lint         # ESLint
npm run build        # Production build
```

## Tech Stack

- **Frontend**: Vue 3, Vite 6, Tailwind CSS 3, Chart.js 4
- **Backend**: Express (single server for local dev and production)
- **Auth**: OpenShift OAuth proxy (production), no auth (local dev)
- **Storage**: Local filesystem (`./data/`), PVC in OpenShift
- **Hosting**: OpenShift with ArgoCD
- **Testing**: Vitest

## Deployment

The app is deployed to OpenShift via ArgoCD. See [deploy/OPENSHIFT.md](deploy/OPENSHIFT.md) for the full deployment guide, including building images on ARM Macs, creating secrets, and troubleshooting.

For local testing with Kind (Kubernetes in Docker), see [deploy/KIND.md](deploy/KIND.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow, project structure, and code style guidelines.

Architecture and deployment details are in [`.claude/CLAUDE.md`](.claude/CLAUDE.md) — Claude Code reads this automatically.
