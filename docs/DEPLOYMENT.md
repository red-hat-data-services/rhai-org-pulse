# Deploying Org Pulse for Your Org

This guide covers how to deploy Org Pulse with your own modules on OpenShift.

## Overview

Org Pulse uses a layered container image architecture. The **core** images contain the platform shell and the People & Teams module. Your org extends these with custom modules.

### Image Registry

| Image | Description |
|-------|-------------|
| `quay.io/org-pulse/org-pulse-core-backend:v1.x` | Backend: Express server + team-tracker module |
| `quay.io/org-pulse/org-pulse-core-frontend:v1.x` | Frontend: pre-built Vue SPA with team-tracker only |
| `quay.io/org-pulse/org-pulse-core-frontend-builder:v1.x` | Frontend build stage (for orgs adding modules) |
| `quay.io/org-pulse/org-pulse-core-frontend-runtime:v1.x` | Frontend nginx runtime (for orgs adding modules) |

## Option A: Core Only (no custom modules)

If you only need the People & Teams module, use the core images directly.

### 1. Create your Kustomize overlay

```
your-org/
  kustomization.yaml
  route-patch.yaml       # Your Route host
  api-route-patch.yaml   # Your API Route host
```

```yaml
# kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: your-namespace

resources:
  - https://github.com/red-hat-data-services/rhai-org-pulse//deploy/openshift/base?ref=v1.0.0

patches:
  - path: route-patch.yaml
  - path: api-route-patch.yaml

configMapGenerator:
  - name: team-tracker-config
    behavior: merge
    literals:
      - ADMIN_EMAILS=admin@redhat.com
      - CRON_ADMIN_EMAIL=admin@redhat.com

images:
  - name: quay.io/org-pulse/org-pulse-core-backend
    newTag: v1.0.0
  - name: quay.io/org-pulse/org-pulse-core-frontend
    newTag: v1.0.0
```

### 2. Create secrets

```bash
oc create secret generic team-tracker-secrets \
  -n your-namespace \
  --from-literal=JIRA_EMAIL=you@redhat.com \
  --from-literal=JIRA_TOKEN=your-jira-api-token

# Optional: GitHub/GitLab contribution stats
oc patch secret team-tracker-secrets -n your-namespace \
  --type merge \
  -p '{"stringData":{"GITHUB_TOKEN":"your-token","GITLAB_TOKEN":"your-token"}}'

# Optional: roster sync (LDAP + Google Sheets)
oc create secret generic ipa-credentials -n your-namespace \
  --from-literal=IPA_BIND_DN='uid=svc-account,cn=users,...' \
  --from-literal=IPA_BIND_PASSWORD='password'

oc create secret generic google-sa-key -n your-namespace \
  --from-file=google-sa-key.json=./path/to/service-account.json
```

### 3. Deploy

```bash
kustomize build your-org/ | oc apply -f -
```

## Option B: Core + Custom Modules

If you have custom modules, build your own images extending the core.

### 1. Create your backend Dockerfile

```dockerfile
# Dockerfile.backend
FROM quay.io/org-pulse/org-pulse-core-backend:v1.x

USER 0

# Add your modules (auto-discovered at startup)
COPY modules/my-module/ ./modules/my-module/

USER 65532
```

### 2. Create your frontend Dockerfile

```dockerfile
# Dockerfile.frontend
FROM quay.io/org-pulse/org-pulse-core-frontend-builder:v1.x AS build

# Add your modules
COPY modules/my-module/ ./modules/my-module/

# Build the Vue SPA (Vite discovers modules at build time)
RUN npm run build

# Serve with nginx
FROM quay.io/org-pulse/org-pulse-core-frontend-runtime:v1.x
COPY --from=build /app/dist /usr/share/nginx/html
```

### 3. Build and push

```bash
podman build -f Dockerfile.backend -t quay.io/your-org/org-pulse-backend:latest .
podman build -f Dockerfile.frontend -t quay.io/your-org/org-pulse-frontend:latest .
podman push quay.io/your-org/org-pulse-backend:latest
podman push quay.io/your-org/org-pulse-frontend:latest
```

### 4. Create your Kustomize overlay

Same as Option A, but override the image names:

```yaml
images:
  - name: quay.io/org-pulse/org-pulse-core-backend
    newName: quay.io/your-org/org-pulse-backend
    newTag: latest
  - name: quay.io/org-pulse/org-pulse-core-frontend
    newName: quay.io/your-org/org-pulse-frontend
    newTag: latest
```

## Secrets

See [deploy/SECRETS.md](../deploy/SECRETS.md) for the full secret catalog.

### Required

| Secret | Keys | Description |
|--------|------|-------------|
| `team-tracker-secrets` | `JIRA_EMAIL`, `JIRA_TOKEN` | Jira Cloud API access |

### Optional (platform)

| Secret | Keys | Description |
|--------|------|-------------|
| `team-tracker-secrets` | `GITHUB_TOKEN` | GitHub contribution stats |
| `team-tracker-secrets` | `GITLAB_TOKEN` | GitLab contribution stats |
| `ipa-credentials` | `IPA_BIND_DN`, `IPA_BIND_PASSWORD` | LDAP roster sync |
| `google-sa-key` | `google-sa-key.json` | Google Sheets roster enrichment |
| `proxy-auth-secret` | `secret` | Shared secret between OAuth proxy and backend |

### Module-specific secrets

Your modules declare secrets in `module.json` under `secrets`. See [docs/MODULES.md](MODULES.md) for the secrets guide.

## CronJob

The base includes a CronJob (`team-tracker-sync-refresh`) that fires every 15 minutes (`*/15 * * * *`) and triggers a cadence-aware refresh via `POST /api/admin/refresh-all`. Each handler declares its own cadence (e.g., `24h` for roster sync, `12h` for execution pipeline). Handlers that have run within their cadence window are skipped — most ticks complete in seconds.

- `concurrencyPolicy: Forbid` prevents overlapping runs
- `activeDeadlineSeconds: 1800` (30 min) accommodates the heaviest handler (`team-tracker:metrics`)
- Backup runs as a refresh handler (`platform:backup`, cadence `24h`), not as a separate script step

Set `CRON_ADMIN_EMAIL` in your ConfigMap to the email of an admin user — this is used as the `X-Forwarded-Email` header for API calls.

## Configuration

All configuration is via ConfigMap (`team-tracker-config`):

| Key | Default | Description |
|-----|---------|-------------|
| `NODE_ENV` | `production` | Node.js environment |
| `API_PORT` | `3001` | Backend port |
| `JIRA_HOST` | `https://redhat.atlassian.net` | Jira Cloud instance URL |
| `ADMIN_EMAILS` | *(empty)* | Comma-separated admin emails. When empty, first authenticated user is auto-added. |
| `CRON_ADMIN_EMAIL` | *(empty)* | Admin email for CronJob API calls |

## Module Development

See [docs/MODULES.md](MODULES.md) for the full module development guide covering:
- Module structure and manifest
- Server context API (storage, auth, refresh hooks, diagnostics)
- Secrets declaration and access
- Frontend navigation and shared composables
