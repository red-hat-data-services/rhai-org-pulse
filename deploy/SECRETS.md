# Secrets Reference

All secrets used by Org Pulse, organized by platform group and module. No structural deployment changes are needed — existing OpenShift Secret objects and `.env` files continue to work.

## Platform Secret Groups

These secrets are shared across multiple modules. Modules declare which groups they need in `module.json > secrets.platform`.

### Jira (`jira`)

Used by: team-tracker, releases, ai-impact

| Env Var | Required | Description |
|---------|----------|-------------|
| `JIRA_EMAIL` | Yes | Jira account email (@redhat.com) |
| `JIRA_TOKEN` | Yes | Jira Cloud API token |

### GitHub (`github`)

Used by: team-tracker, ai-impact, system-health

**Preferred: GitHub App authentication** — generates short-lived installation
tokens that auto-expire after 1 hour. Higher rate limits (12,500 GraphQL +
15,000 REST vs 5,000 each for a PAT).

| Env Var | Required | Description |
|---------|----------|-------------|
| `GITHUB_APP_ID` | No | GitHub App ID (via ConfigMap) |
| `GITHUB_APP_PRIVATE_KEY` | No | RSA private key PEM content (via `team-tracker-secrets`) |
| `GITHUB_APP_INSTALLATION_ID` | No | Installation ID for the target org (via ConfigMap) |
| `GITHUB_TOKEN` | No | Classic PAT with `read:user` scope (local dev fallback when App vars are not set) |

If all three `GITHUB_APP_*` vars are set, the backend generates installation
tokens automatically and `GITHUB_TOKEN` is ignored. If App auth fails at
startup, falls back to `GITHUB_TOKEN` if set.

### GitLab (`gitlab`)

Used by: team-tracker, ai-impact

| Env Var | Required | Description |
|---------|----------|-------------|
| `GITLAB_TOKEN` | No | GitLab PAT with `read_api` scope |

### IPA LDAP (`ipa`)

Used by: team-tracker

| Env Var | Required | Description |
|---------|----------|-------------|
| `IPA_BIND_DN` | No | LDAP bind DN for IPA roster sync |
| `IPA_BIND_PASSWORD` | No | LDAP bind password |

### Google (`google`)

Used by: team-tracker

| Env Var | Required | Description |
|---------|----------|-------------|
| `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` | No | Path to Google SA JSON key (volume-mounted) |

## Module-Specific Secrets

### team-tracker

| Env Var | Required | Description |
|---------|----------|-------------|
| `GITLAB_CEE_REDHAT_DOCS_TOKEN` | No | GitLab PAT for internal documentation instance |

Dynamic secrets: `GITLAB_*_TOKEN` — per-instance GitLab tokens configured via Settings UI.

### releases

| Env Var | Required | Group | Description |
|---------|----------|-------|-------------|
| `PRODUCT_PAGES_CLIENT_ID` | No | auth | OAuth client ID for Product Pages |
| `PRODUCT_PAGES_CLIENT_SECRET` | No | auth | OAuth client secret for Product Pages |
| `PRODUCT_PAGES_TOKEN` | No | auth (exclusive) | Personal token fallback for local dev |
| `FEATURE_TRAFFIC_GITLAB_TOKEN` | No | | GitLab PAT for CI artifact fetching |
| `SMARTSHEET_API_TOKEN` | No | | SmartSheet API token for release discovery |

### ai-impact

| Env Var | Required | Description |
|---------|----------|-------------|
| `GITLAB_CEE_REDHAT_DOCS_TOKEN` | No | GitLab PAT for internal documentation instance |

## OpenShift Deployment

All secrets are stored in a single `team-tracker-secrets` Secret object. See `deploy/OPENSHIFT.md` for creation commands.

```bash
# Create the secret
oc create secret generic team-tracker-secrets \
  -n team-tracker \
  --from-literal=JIRA_EMAIL=you@redhat.com \
  --from-literal=JIRA_TOKEN=your-jira-api-token

# Patch to add optional secrets
oc patch secret team-tracker-secrets -n team-tracker \
  --type merge \
  -p '{"stringData":{"GITHUB_TOKEN":"your-token"}}'

# GitHub App auth (preferred for production) — add PEM key to the same secret
oc patch secret team-tracker-secrets -n team-tracker \
  --type merge \
  -p "{\"stringData\":{\"GITHUB_APP_PRIVATE_KEY\":\"$(cat /path/to/key.pem)\"}}"
```

The backend deployment (`deploy/openshift/base/backend-deployment.yaml`) maps each secret key to an env var via `secretKeyRef` with `optional: true` for non-required secrets.

### Volume-Mounted Secrets

| Secret | Mount Path | Description |
|--------|-----------|-------------|
| `google-sa-key` | `/etc/secrets/google-sa-key.json` | Google service account key |

## Configuration Variables (Not Secrets)

These are non-sensitive configuration values that remain as plain env vars (in ConfigMap or `.env`). They are **not** managed by the secrets system:

`DEMO_MODE`, `NODE_ENV`, `API_PORT`, `JIRA_HOST`, `GITLAB_BASE_URL`, `JIRA_STORY_POINTS_FIELD`, `PRODUCT_PAGES_BASE_URL`, `SMARTSHEET_SHEET_ID`, `UPSTREAM_PULSE_API_URL`, `PRODUCT_BUILDS_API_URL`, `AUTH_EMAIL_DOMAIN`, `ADMIN_EMAILS`, `GITHUB_APP_ID`, `GITHUB_APP_INSTALLATION_ID`

## Diagnostics

- **Startup**: The SecretRegistry logs warnings for missing required secrets at startup
- **Admin API**: `GET /api/admin/secrets/status` returns configured/missing status (never actual values)
- **Validation**: `POST /api/admin/secrets/validate` runs registered connectivity validators
- **Must-gather**: The diagnostic bundle includes `bundle.secrets` with full status
