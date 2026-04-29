# Deploying to OpenShift

This guide covers deploying the app to an OpenShift cluster. For local testing with Kind, see [KIND.md](KIND.md).

## Prerequisites

- `oc` CLI installed and logged into your cluster (`oc login`)
- [Podman](https://podman.io/getting-started/installation) or Docker installed
- Logged into quay.io (`podman login quay.io`)
- Jira API token ([create one here](https://id.atlassian.com/manage-profile/security/api-tokens))

## 1. Create the namespace

```bash
oc new-project team-tracker
```

## 2. Create secrets

Three secrets are needed (created manually, not stored in git):

```bash
# Required: Jira credentials
oc create secret generic team-tracker-secrets \
  -n team-tracker \
  --from-literal=JIRA_EMAIL=you@redhat.com \
  --from-literal=JIRA_TOKEN=your-jira-api-token

# Optional: GitHub token (for contribution stats)
# Use a classic PAT with read:user scope — fine-grained tokens don't work with GraphQL
# Important: use tr -d '\n' to strip trailing newlines from token files
oc patch secret team-tracker-secrets \
  -n team-tracker \
  --type merge \
  -p "{\"stringData\":{\"GITHUB_TOKEN\":\"$(tr -d '\n' < ~/.your-github-token)\"}}"

# Optional: GitLab token (for contribution stats)
# Use a PAT with read_api scope
oc patch secret team-tracker-secrets \
  -n team-tracker \
  --type merge \
  -p "{\"stringData\":{\"GITLAB_TOKEN\":\"$(tr -d '\n' < ~/.your-gitlab-token)\"}}"

# Optional: Feature Traffic GitLab token (for CI artifact fetching)
# Only needed if the feature-traffic pipeline project requires a different token than GITLAB_TOKEN
# Use a PAT with read_api scope
oc patch secret team-tracker-secrets \
  -n team-tracker \
  --type merge \
  -p "{\"stringData\":{\"FEATURE_TRAFFIC_GITLAB_TOKEN\":\"$(tr -d '\n' < ~/.your-ft-gitlab-token)\"}}"

# Required: OAuth proxy cookie secret
oc create secret generic frontend-proxy-cookie \
  -n team-tracker \
  --from-literal=session_secret="$(openssl rand -base64 32)"

# Optional: Google service account key (for roster sync from Google Sheets)
oc create secret generic google-sa-key \
  -n team-tracker \
  --from-file=google-sa-key.json=./secrets/google-sa-key.json

# Optional: SmartSheet API token (for release-planning module -- release discovery)
# Generate a token at: My Account > Personal Settings > API Access > Generate New Access Token
oc patch secret team-tracker-secrets \
  -n team-tracker \
  --type merge \
  -p "{\"stringData\":{\"SMARTSHEET_API_TOKEN\":\"$(tr -d '\n' < ~/.your-smartsheet-token)\"}}"
```

## 3. Build container images

Images must be built for `linux/amd64` since OpenShift clusters run x86_64.

### On ARM Macs (Apple Silicon)

The standard `--platform linux/amd64` flag causes issues: `npm ci` times out under QEMU emulation, and esbuild crashes during cross-platform Vite builds. The workaround is to build/install natively on your Mac and copy the artifacts into amd64 base images.

**Frontend** — build the SPA locally, then package into an amd64 nginx image:

```bash
# Build the Vue SPA natively
npm run build

# Create a minimal Dockerfile for the pre-built assets
cat > /tmp/frontend-amd64.Dockerfile <<'EOF'
FROM registry.access.redhat.com/ubi9/nginx-124
COPY deploy/nginx.conf /opt/app-root/etc/nginx.default.d/app.conf
COPY dist/ /opt/app-root/src/
USER 1001
EXPOSE 8080
CMD ["/usr/libexec/s2i/run"]
EOF

# Build using a temp context (dist/ is in .dockerignore)
TMPDIR=$(mktemp -d)
cp -r dist "$TMPDIR/dist"
cp -r deploy "$TMPDIR/deploy"
podman build --platform linux/amd64 -t quay.io/org-pulse/team-tracker-frontend:latest \
  -f /tmp/frontend-amd64.Dockerfile "$TMPDIR"
rm -rf "$TMPDIR"
```

**Backend** — install production deps natively (pure JS, no native addons), then package into an amd64 node image:

```bash
# Create a temp context with native node_modules
cat > /tmp/backend-amd64.Dockerfile <<'EOF'
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY node_modules/ ./node_modules/
COPY server/ ./server/
COPY shared/server/ ./shared/server/
COPY modules/ ./modules/
RUN mkdir -p /app/data && chown -R 1001:0 /app/data && chmod -R g+rwX /app/data
USER 1001
EXPOSE 3001
ENV NODE_ENV=production
ENV API_PORT=3001
CMD ["node", "server/dev-server.js"]
EOF

TMPDIR=$(mktemp -d)
cp package.json package-lock.json "$TMPDIR/"
cp -r server "$TMPDIR/server"
mkdir -p "$TMPDIR/shared"
cp -r shared/server "$TMPDIR/shared/server"
cp -r modules "$TMPDIR/modules"
cd "$TMPDIR" && npm ci --omit=dev && cd -
podman build --platform linux/amd64 -t quay.io/org-pulse/team-tracker-backend:latest \
  -f /tmp/backend-amd64.Dockerfile "$TMPDIR"
rm -rf "$TMPDIR"
```

> **Why this works:** The backend has no native Node addons (verified by checking for `.node` files in `node_modules`). All dependencies are pure JavaScript, so ARM-built `node_modules` run fine on amd64 Node.

### On x86_64 machines

Build directly with the standard Dockerfiles:

```bash
podman build -t quay.io/org-pulse/team-tracker-backend:latest -f deploy/backend.Dockerfile .
podman build -t quay.io/org-pulse/team-tracker-frontend:latest -f deploy/frontend.Dockerfile .
```

## 4. Push images

```bash
podman push quay.io/org-pulse/team-tracker-backend:latest
podman push quay.io/org-pulse/team-tracker-frontend:latest
```

Ensure the repositories are public on quay.io, or configure image pull secrets on the cluster.

## 5. Apply manifests

```bash
# Dev cluster
oc apply -k deploy/openshift/overlays/dev/

# Prod cluster
oc apply -k deploy/openshift/overlays/prod/
```

Verify pods are running:
```bash
oc get pods -n team-tracker
```

The route URL is auto-generated:
```bash
oc get route team-tracker -n team-tracker -o jsonpath='{.spec.host}'
```

## Dev vs prod overlays

| Aspect | Dev (`overlays/dev/`) | Preprod (`overlays/preprod/`) | Prod (`overlays/prod/`) |
|--------|----------------------|------------------------------|------------------------|
| Namespace | `team-tracker` | `ambient-code--team-tracker` | `ambient-code--team-tracker` |
| `ADMIN_EMAILS` | Unset (first user auto-added to allowlist) | Inherits from base | Set to admin email (pre-seeds allowlist) |
| Route hostname | Auto-generated | Patched to preprod hostname | Patched to prod hostname |
| Images | `:latest` | `:latest` (inherits from base) | Pinned to git SHA tags |

In dev, when `ADMIN_EMAILS` is empty the first authenticated user is automatically added as admin. This makes it easy for any team member to test without needing their email pre-configured.

## Updating after code changes

Rebuild the affected image(s), push, and restart:

```bash
# Rebuild and push (see step 3 for ARM Mac instructions)
podman push quay.io/org-pulse/team-tracker-backend:latest
podman push quay.io/org-pulse/team-tracker-frontend:latest

# Restart to pull new images
oc rollout restart deployment/backend deployment/frontend -n team-tracker
```

## Viewing logs

```bash
# Backend
oc logs deployment/backend -n team-tracker -f

# Frontend (nginx)
oc logs deployment/frontend -n team-tracker -c nginx -f

# OAuth proxy
oc logs deployment/frontend -n team-tracker -c oauth-proxy -f
```

## Troubleshooting

### `Exec format error`

Images were built for the wrong architecture. Rebuild with `--platform linux/amd64` (see step 3).

### OAuth proxy: `listen tcp :4180: bind: address already in use`

The oauth-proxy `--http-address` defaults to `:4180`, conflicting with `--https-address=:4180`. The base manifest includes `--http-address=` (empty) to disable the HTTP listener. If you see this error, ensure the frontend deployment has this arg.

### `Access denied. You are not on the allowlist.`

The authenticated user's email doesn't match any entry in `data/allowlist.json` on the PVC. Options:
- **Dev:** Remove `ADMIN_EMAILS` from the configmap so the first user is auto-added (the dev overlay does this).
- **Prod:** Add the user's email to `ADMIN_EMAILS` in the configmap, or use the Settings UI to manage the allowlist.
- **Quick fix:** Shell into the backend pod and edit the allowlist directly:
  ```bash
  oc exec -it deployment/backend -n team-tracker -- cat /app/data/allowlist.json
  ```

### `Cannot read properties of null (reading 'orgs')`

The roster hasn't been synced yet. Go to Settings and configure roster sync, then click "Sync Now". This is normal on a fresh deployment.

### GitHub API: `bearer ... is not a legal HTTP header value`

The `GITHUB_TOKEN` secret contains a trailing newline. Recreate it with the newline stripped:
```bash
oc patch secret team-tracker-secrets -n team-tracker \
  --type merge \
  -p "{\"stringData\":{\"GITHUB_TOKEN\":\"$(tr -d '\n' < ~/.your-github-token)\"}}"
oc rollout restart deployment/backend -n team-tracker
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│ OpenShift Route (TLS reencrypt)                 │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│ Frontend Pod                                     │
│  ┌─────────────────┐  ┌──────────────────────┐  │
│  │ OAuth Proxy     │  │ nginx                │  │
│  │ :4180 (HTTPS)   │──│ :8080                │  │
│  │ Sets X-Forwarded│  │ Serves SPA           │  │
│  │ headers         │  │ Proxies /api→backend │  │
│  └─────────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────┘
                       │ /api
┌──────────────────────▼──────────────────────────┐
│ Backend Pod                                      │
│  ┌──────────────────────────────────────────┐   │
│  │ Express :3001                             │   │
│  │ Jira API, GitHub API, Roster Sync, LDAP  │   │
│  └──────────────────────────────────────────┘   │
│  Volume: /app/data (PVC: team-tracker-data)     │
└─────────────────────────────────────────────────┘
```
