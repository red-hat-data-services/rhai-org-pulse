# Production Runbook — Org Pulse (Team Tracker)

## Service Overview

**Org Pulse** is a modular engineering dashboard connecting Jira, GitHub, and GitLab data with a team roster to surface delivery insights. The AI Engineering instance is branded **Team Tracker**.

| | |
|---|---|
| **Stack** | Vue 3 SPA + Express backend, deployed on OpenShift via ArgoCD |
| **Source repo** | `github.com/red-hat-data-services/rhai-org-pulse` |
| **GitOps repo** | `github.com/red-hat-data-services/ambient-code-gitops` |
| **Image registry** | `quay.io/org-pulse/` |
| **ArgoCD namespace** | `ambient-code--argocd` |

---

## Environments

### Production

| | |
|---|---|
| **Cluster** | `prod-spoke-aws-us-west-2` |
| **Cluster API** | `https://api.mpp-w2-prod.0jgd.p1.openshiftapps.com:6443` |
| **OpenShift Console** | [console](https://console-openshift-console.apps.mpp-w2-prod.0jgd.p1.openshiftapps.com/k8s/ns/ambient-code--team-tracker/core~v1~Pod) |
| **ArgoCD** | [argocd](https://ambient-code-argo.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com) |
| **Namespace** | `ambient-code--team-tracker` |
| **UI URL** | `https://team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com` |
| **API URL** | `https://api-team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com` |
| **Source branch** | `main` |
| **Kustomize path** | `deploy/openshift/overlays/ai-eng-prod` |
| **Image tags** | Pinned to `:<git-sha>` |
| **ArgoCD app manifest** | `ambient-code-gitops/clusters/prod-spoke-aws-us-west-2/apps/team-tracker.yaml` |

### Pre-production

| | |
|---|---|
| **Cluster** | `preprod-spoke-aws-us-west-2` |
| **Cluster API** | `https://api.mpp-w2-preprod.cfln.p1.openshiftapps.com:6443` |
| **OpenShift Console** | [console](https://console-openshift-console.apps.mpp-w2-preprod.cfln.p1.openshiftapps.com/k8s/ns/ambient-code--team-tracker/core~v1~Pod) |
| **ArgoCD** | [argocd](https://ambient-code-argo.apps.int.spoke.preprod.us-west-2.aws.paas.redhat.com) |
| **Namespace** | `ambient-code--team-tracker` |
| **UI URL** | `https://team-tracker.apps.int.spoke.preprod.us-west-2.aws.paas.redhat.com` |
| **API URL** | `https://api-team-tracker.apps.int.spoke.preprod.us-west-2.aws.paas.redhat.com` |
| **Source branch** | `preprod` |
| **Kustomize path** | `deploy/openshift/overlays/ai-eng-preprod` |
| **Image tags** | Pinned to `:<git-sha>` |
| **ArgoCD app manifest** | `ambient-code-gitops/clusters/preprod-spoke-aws-us-west-2/apps/team-tracker.yaml` |

> **Note:** There is no dev cluster deployment for team-tracker. Development is done locally.

### Other Org Pulse Instances (same platform, different tenants)

| Instance | Namespace | Cluster | Source Repo |
|----------|-----------|---------|-------------|
| **CCS Org Pulse** | `ambient-code--ccs-org-pulse` | prod | `gitlab.cee.redhat.com/docs-management-tooling/ccs-org-pulse.git` |
| **UIE Org Pulse** | `ambient-code--uie-org-pulse` | prod | `github.com/red-hat-data-services/rhai-org-pulse.git` (overlay: `deploy/openshift/overlays/prod`) |

---

## Architecture

```
                         Internet / VPN
                              |
                    ┌─────────▼──────────┐
                    │  OpenShift Route    │
                    │  TLS reencrypt      │
                    └─────────┬──────────┘
                              |
          ┌───────────────────▼───────────────────┐
          │          Frontend Pod                   │
          │  ┌────────────────┐  ┌──────────────┐ │
          │  │  OAuth Proxy   │  │    nginx      │ │
          │  │  :4180 (HTTPS) │─>│    :8080      │ │
          │  │  Sets X-Fwd-*  │  │  Serves SPA   │ │
          │  │  headers       │  │  Proxies /api  │ │
          │  └────────────────┘  └──────┬───────┘ │
          └─────────────────────────────┼─────────┘
                                        │ /api/*
          ┌─────────────────────────────▼─────────┐
          │           Backend Pod                   │
          │  ┌──────────────────────────────────┐  │
          │  │  Express :3001                    │  │
          │  │  Module auto-discovery            │  │
          │  │  Jira / GitHub / GitLab / LDAP    │  │
          │  └──────────────────────────────────┘  │
          │  Volume: /app/data (PVC)               │
          └────────────────────────────────────────┘
```

### Container Images

| Component | Image | Base |
|-----------|-------|------|
| Backend | `quay.io/org-pulse/team-tracker-backend` | Extends `org-pulse-core-backend` |
| Frontend | `quay.io/org-pulse/team-tracker-frontend` | Built from `org-pulse-core-frontend-builder` + `org-pulse-core-frontend-runtime` |
| OAuth Proxy | `quay.io/openshift/origin-oauth-proxy:4.16` | Sidecar on frontend pod |

### Ports

| Component | Port | Protocol |
|-----------|------|----------|
| Backend (Express) | 3001 | HTTP |
| Frontend (nginx) | 8080 | HTTP |
| OAuth Proxy | 4180 | HTTPS |

---

## Access Control

### Rover Group

Cluster and ArgoCD access is gated by the **ambient-code-support** Rover group:

- **Rover URL**: https://rover.redhat.com/groups/group/ambient-code-support
- **LDAP DN**: `cn=ambient-code-support,ou=adhoc,ou=managedGroups,dc=redhat,dc=com`
- **Tenant config**: https://gitlab.cee.redhat.com/paas/gitops-tenant-management/-/tree/main/tenants/ambient-code

Membership in this group grants:

| Access | Role | What it provides |
|--------|------|------------------|
| **OpenShift namespaces** | `namespace-editor` + `namespace-admin` | `oc` access to all `ambient-code--*` namespaces (view/edit pods, logs, secrets, exec) |
| **ArgoCD** | `admin` + `user` | View, sync, and restart applications in the ArgoCD UI and CLI |

This is configured via two MPP `TenantGroup` CRs (defined in `ambient-code-gitops/clusters/*/tenant/tenant.yaml`):

- `ambient-code-editors` — maps the Rover group to `namespace-editor`
- `ambient-code-egress-admins` — maps the Rover group to `namespace-admin` + `tenant-egress-admin`

ArgoCD RBAC is configured in `ambient-code-gitops/argocd/argocd.yaml`:

```
g, ambient-code-support, role:admin
g, ambient-code-support, role:user
```

**To grant someone cluster access**, add them to the Rover group. No other configuration is needed — the TenantGroup and ArgoCD RBAC pick up group membership automatically via LDAP sync.

## Auth Flow

1. User hits the Route URL
2. OAuth proxy sidecar authenticates via OpenShift OAuth
3. Proxy sets `X-Forwarded-Email` and `X-Forwarded-User` headers
4. nginx passes `/api/*` requests to the backend with these headers
5. Backend reads `X-Forwarded-Email` and checks against `data/roles.json`
6. Empty role store = first authenticated user is auto-added as admin

### Auth Config

- `ADMIN_EMAILS` (ConfigMap) — pre-seeds the role store with known admins
- `AUTH_EMAIL_DOMAIN` — normalizes emails for role matching (prod: `cluster.local`)
- `data/roles.json` — runtime role store, managed via API

---

## Deployment & CI/CD

### How Deployments Work

ArgoCD watches the source repo with **automated sync policy**. The flow is:

1. Code merges to `main`
2. CI runs (`ci.yml`): lint, test, build, kustomize validate
3. `build-images.yml` triggers:
   a. Bumps patch version, creates git tag
   b. Builds core images, then AI Eng images (extending core)
   c. Runs Playwright smoke tests
   d. Pushes images to Quay (`:<sha>` + `:latest`)
   e. Commits image tag update to `deploy/openshift/overlays/ai-eng-prod/kustomization.yaml` on `main`
4. ArgoCD detects the kustomization change and syncs
5. ConfigMap names include content hashes — any data change triggers a pod rollout automatically

### Branch Protection

- `main` branch requires PRs with passing "Test & Build" status check
- A GitHub App (`APP_ID`/`APP_PRIVATE_KEY`) has bypass for CI commits (version bumps, deploy tag updates)

### Preprod vs Prod Image Strategy

| Environment | Image Tag | Update Mechanism |
|-------------|-----------|------------------|
| Preprod | `:<git-sha>` | Pinned — CI commits tag update to `preprod` branch |
| Prod | `:<git-sha>` | Pinned — CI commits tag update to `main` |

### GitOps Patches Applied by ArgoCD

The ArgoCD Application manifests in `ambient-code-gitops` apply additional patches at sync time:

- **PVC**: Storage class set to `aws-ebs` with `Delete` reclaim policy
- **Backend Deployment**: Proxy env vars injected (`HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY` pointing to `proxy.squi-001.prod.iad2.dc.redhat.com:3128`)
- **Common label**: `paas.redhat.com/appcode: AMBC-001` on all resources

---

## Persistent Storage

### PVC

- **Name**: `team-tracker-data`
- **Mount path**: `/app/data` (backend pod)
- **Storage class**: `aws-ebs` (patched by ArgoCD)
- **Access mode**: ReadWriteOnce

### Data Directory Layout

```
data/
  roles.json                    # Auth role store
  site-config.json              # Platform settings
  org-roster-full.json          # LDAP + Google Sheets merged roster
  jira-name-map.json            # Cached Jira user name/ID mappings
  messages.json                 # Admin announcements
  roster-sync-config.json       # Sync configuration (UI-editable)
  team-data/
    registry.json               # Team metadata
    field-definitions.json      # Jira field mappings
    field-options/              # Named allowed-value sets
  people/{name}.json              # Per-person Jira metrics (365-day lookback)
  snapshots/{teamKey}/{date}.json # Team snapshots (teamKey sanitized: :: → --)
  github-contributions.json
  gitlab-contributions.json
  releases/
    registry.json               # Release registry
    execution/
      index.json                # Feature index
      features/{KEY}.json       # Per-feature files
    hygiene-config.json
  notifications/
    users/{email}.json          # Per-user dismiss state
```

> All data access goes through `readFromStorage` / `writeToStorage` abstractions — never raw filesystem paths.

---

## CronJob

| | |
|---|---|
| **Name** | `team-tracker-sync-refresh` |
| **Schedule** | `*/15 * * * *` (every 15 minutes) |
| **Concurrency** | `Forbid` (no overlapping runs) |
| **Deadline** | 30 minutes (`activeDeadlineSeconds: 1800`) |
| **Action** | `POST /api/admin/refresh-all` |
| **User** | `CRON_ADMIN_EMAIL` from ConfigMap |

### Cadence-Aware Handlers

Each refresh handler declares its own cadence. Handlers that ran within their window are skipped.

| Handler | Cadence | Purpose |
|---------|---------|---------|
| Roster sync | 24h | LDAP + Google Sheets |
| Person metrics | 24h | Jira stats per person |
| GitHub contributions | 12h | GitHub GraphQL API |
| GitLab contributions | 12h | GitLab GraphQL API |
| Execution pipeline | 12h | Releases feature data |
| Hygiene refresh | 12h | Hygiene rules evaluation |
| Backup | 24h | S3 backup of data directory |

Most CronJob ticks complete in seconds (only handlers past their cadence run).

---

## Secrets

Secrets are created manually in each namespace — they are **not** stored in git.

### team-tracker-secrets

| Key | Required | Description |
|-----|----------|-------------|
| `JIRA_EMAIL` | Yes | Jira service account email |
| `JIRA_TOKEN` | Yes | Jira Cloud API token |
| `GITHUB_APP_PRIVATE_KEY` | Recommended | GitHub App PEM key (higher rate limits) |
| `GITHUB_TOKEN` | Fallback | Classic PAT with `read:user` scope |
| `GITLAB_TOKEN` | Optional | GitLab PAT with `read_api` scope |
| `PRODUCT_PAGES_CLIENT_ID` | Optional | Product Pages OAuth client ID |
| `PRODUCT_PAGES_CLIENT_SECRET` | Optional | Product Pages OAuth client secret |
| `SMARTSHEET_API_TOKEN` | Optional | Release discovery |
| `FEATURE_TRAFFIC_GITLAB_TOKEN` | Optional | Override GitLab token for CI artifacts |
| `GITLAB_CEE_REDHAT_DOCS_TOKEN` | Optional | Internal GitLab instance token |
| `GOOGLE_OAUTH_CLIENT_ID` | Optional | Customer insights OAuth |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Optional | Customer insights OAuth |
| `GOOGLE_PICKER_API_KEY` | Optional | Google Picker API |
| `GOOGLE_SPREADSHEET_ID` | Optional | Google Spreadsheet ID for roster enrichment data |
| `MODELS_CORP_API_KEY` | Optional | Granite AI (customer insights) |
| `MODELS_CORP_BASE_URL` | Optional | Granite AI base URL |

### Other Secrets

| Secret Name | Keys | Purpose |
|-------------|------|---------|
| `ipa-credentials` | `IPA_BIND_DN`, `IPA_BIND_PASSWORD` | LDAP bind credentials for roster sync |
| `proxy-auth-secret` | `secret` | Shared secret for CronJob-to-backend authentication. Generate with `openssl rand -hex 32` |
| `frontend-proxy-cookie` | (single value) | OAuth proxy session secret. Generate with `openssl rand -base64 32` |
| `google-sa-key` | `google-sa-key.json` | Google service account JSON key, volume-mounted to `/etc/secrets/google-sa-key.json` |
| `aws-backup-credentials` | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_BACKUP_BUCKET` | AWS S3 backup credentials and bucket name |

### Secret Diagnostics

- `GET /api/admin/secrets/status` — shows configured vs missing secrets (no values exposed)
- `POST /api/admin/secrets/validate` — runs connectivity validators

---

## Health Checks & Monitoring

### Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /healthz` | Backend health check (used by liveness/readiness probes, pre-auth) |
| `GET /api/healthz` | Authenticated health check with additional detail |
| `GET /api/whoami` | Returns authenticated user info |
| `GET /api/must-gather?redact=minimal` | Admin-only diagnostics bundle (build info, system stats, storage health, module diagnostics, error buffer) |

### Liveness & Readiness Probes

Defined in the core base deployment (`backend-deployment.yaml`):

- **Readiness**: `GET /healthz` on port 3001, initial delay 5s, period 10s
- **Liveness**: `GET /healthz` on port 3001, initial delay 10s, period 30s

---

## Operational Procedures

### View Logs

```bash
# Backend logs
oc logs deployment/backend -n ambient-code--team-tracker -f

# Frontend (nginx) logs
oc logs deployment/frontend -n ambient-code--team-tracker -c nginx -f

# OAuth proxy logs
oc logs deployment/frontend -n ambient-code--team-tracker -c oauth-proxy -f

# CronJob logs (most recent)
oc logs job/$(oc get jobs -n ambient-code--team-tracker --sort-by=.metadata.creationTimestamp -o jsonpath='{.items[-1].metadata.name}') -n ambient-code--team-tracker
```

### Restart Pods

```bash
oc rollout restart deployment/backend -n ambient-code--team-tracker
oc rollout restart deployment/frontend -n ambient-code--team-tracker
```

### Check Pod Status

```bash
oc get pods -n ambient-code--team-tracker
oc describe pod <pod-name> -n ambient-code--team-tracker
```

### Check ArgoCD Sync Status

```bash
# From ambient-code-gitops
oc get application team-tracker -n ambient-code--argocd -o jsonpath='{.status.sync.status}'
oc get application team-tracker -n ambient-code--argocd -o jsonpath='{.status.health.status}'
```

### Manual Data Refresh

```bash
# Trigger a full refresh (cadence-aware — only stale handlers run)
curl -X POST https://api-team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/api/admin/refresh-all \
  -H "Authorization: Bearer $TOKEN"

# Force a specific handler (bypasses cadence)
# Handler IDs follow the pattern <module>:<handler>, e.g.:
#   team-tracker:roster-sync, team-tracker:metrics, team-tracker:github,
#   team-tracker:gitlab, team-tracker:snapshots, releases:execution
curl -X POST https://api-team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/api/admin/refresh/handler/team-tracker:roster-sync \
  -H "Authorization: Bearer $TOKEN"
```

### Check Current Image Tags (Prod)

```bash
# In the source repo
grep -A2 'newTag\|newName' deploy/openshift/overlays/ai-eng-prod/kustomization.yaml
```

### Backup & Restore

Backup runs automatically as a refresh handler (cadence: 24h) to the S3 bucket configured via `AWS_BACKUP_BUCKET`. Manual backup:

```bash
curl -X POST https://api-team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/api/admin/backup \
  -H "Authorization: Bearer $TOKEN"
```

### Collect Diagnostics

```bash
curl https://api-team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/api/must-gather?redact=minimal \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Rotate a Secret

```bash
# Update a secret value (e.g., JIRA_TOKEN)
oc patch secret team-tracker-secrets \
  -n ambient-code--team-tracker \
  --type merge \
  -p '{"stringData":{"JIRA_TOKEN":"new-token-value"}}'

# Restart backend to pick up the change
oc rollout restart deployment/backend -n ambient-code--team-tracker
```

> **Warning:** Strip trailing newlines from token values. Use `tr -d '\n'` when reading from files.

---

## Rollback

### Option 1: Revert Image Tag (Fastest)

Edit `deploy/openshift/overlays/ai-eng-prod/kustomization.yaml` to point to a previous image SHA, commit, and push. ArgoCD auto-syncs.

### Option 2: Git Revert

```bash
git revert <commit-sha>   # Revert the problematic change
git push origin main       # ArgoCD auto-syncs
```

### Option 3: ArgoCD Manual Sync to Previous Commit

Use the ArgoCD UI or CLI to sync to a specific git revision.

---

## Proxy Configuration

Production backend pods route external traffic through the Red Hat corporate proxy (applied via ArgoCD patch):

| Variable | Value |
|----------|-------|
| `HTTP_PROXY` | `http://proxy.squi-001.prod.iad2.dc.redhat.com:3128` |
| `HTTPS_PROXY` | `http://proxy.squi-001.prod.iad2.dc.redhat.com:3128` |
| `NO_PROXY` | `.cluster.local,.svc,10.0.0.0/8,172.16.0.0/12` |

This is required for the backend to reach external APIs (Jira, GitHub, GitLab, LDAP).

---

## Key Contacts & Resources

| Resource | Location |
|----------|----------|
| Source code | `github.com/red-hat-data-services/rhai-org-pulse` |
| GitOps config | `github.com/red-hat-data-services/ambient-code-gitops` |
| Core platform | `github.com/red-hat-data-services/org-pulse-core` |
| Image registry | `quay.io/org-pulse/` |
| Prod API docs | `https://api-team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/api/docs/` |

### API Tokens

The app has a built-in token system for programmatic API access (used by Claude Code, scripts, CI, etc.). Tokens are per-user — any authenticated user can create their own via the Settings UI or the API. Tokens are stored in `data/tokens.json`.

**Create a token via the UI:**

1. Log into the app
2. Go to Settings > API Tokens
3. Click "Create Token", give it a name (e.g. `claude-code`), optionally set expiry (`30d`, `90d`, `1y`) and scope restrictions
4. Copy the token — it's shown only once

**Create a token via the API** (requires an existing session or token with `tokens:manage` scope):

```bash
curl -X POST https://api-team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/api/tokens \
  -H "Authorization: Bearer $EXISTING_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "claude-code"}'
```

The response includes a token with a `tt_` prefix. Store it locally (e.g. `~/.org-pulse-token`) and use it for API access:

```bash
curl https://api-team-tracker.apps.int.spoke.prod.us-west-2.aws.paas.redhat.com/api/whoami \
  -H "Authorization: Bearer tt_..."
```

Admins can list and revoke any user's tokens via `GET /api/admin/tokens` and `DELETE /api/admin/tokens/{id}`.

For Claude Code, save the token to a file and reference it in your `~/.claude/CLAUDE.md` so the agent can authenticate against the production API.
