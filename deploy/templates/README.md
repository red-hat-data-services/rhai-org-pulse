# App-Interface Deploy Templates

OpenShift Templates for deploying RHAI Org Pulse via app-interface SaaS files.
These templates coexist with the Kustomize manifests in `deploy/openshift/`,
which remain available for direct/dev deployment.

## Templates

| Template | Resources |
|----------|-----------|
| `backend.yaml` | ConfigMap, Deployment, Service, Route, PVC, CronJob |
| `frontend.yaml` | ServiceAccount, Deployment (oauth-proxy + nginx), Service, Route |

## Quick Start

Validate templates locally (requires `oc` CLI):

```bash
oc process -f deploy/templates/backend.yaml | oc apply --dry-run=client -f -
oc process -f deploy/templates/frontend.yaml | oc apply --dry-run=client -f -
```

Or with parameter overrides:

```bash
oc process -f deploy/templates/backend.yaml \
  -p BACKEND_IMAGE_TAG=abc123 \
  -p ADMIN_EMAILS=user@redhat.com \
  -p CRONJOB_SUSPEND=true \
  | oc apply --dry-run=client -f -
```

## Parameters

### Backend (`backend.yaml`)

| Parameter | Default | Description |
|-----------|---------|-------------|
| `BACKEND_IMAGE` | `quay.io/redhat-services-prod/hcm-eng-prod-tenant/rhai-org-pulse-backend` | Backend container image |
| `BACKEND_IMAGE_TAG` | `latest` | Backend image tag (required) |
| `BACKEND_REPLICAS` | `1` | Replica count |
| `JIRA_HOST` | `https://redhat.atlassian.net` | Jira instance URL |
| `ADMIN_EMAILS` | *(empty)* | Comma-separated admin email list |
| `API_PUBLIC_URL` | *(empty)* | Public URL of the API route |
| `AUTH_EMAIL_DOMAIN` | *(empty)* | Email domain override for auth matching |
| `API_ROUTE_HOST` | *(empty)* | API route hostname (auto-assigned if empty) |
| `ROUTE_SHARD_LABEL` | *(empty)* | Route `shard` label (e.g. `internal`) |
| `ROUTE_APPCODE_LABEL` | `HPOP-0001` | Route `paas.redhat.com/appcode` label |
| `PVC_STORAGE_SIZE` | `1Gi` | Data volume size |
| `BACKEND_MEMORY_REQUEST` | `256Mi` | Backend memory request |
| `BACKEND_MEMORY_LIMIT` | `512Mi` | Backend memory limit |
| `BACKEND_CPU_REQUEST` | `250m` | Backend CPU request |
| `BACKEND_CPU_LIMIT` | `500m` | Backend CPU limit |
| `CRONJOB_SCHEDULE` | `0 6 * * *` | Daily sync cron schedule |
| `CRONJOB_SUSPEND` | `false` | Set `true` to disable the CronJob (e.g. on stage) |
| `CRONJOB_ADMIN_EMAIL` | *(empty)* | Email used in CronJob `X-Forwarded-Email` header |
| `CRONJOB_IMAGE` | `registry.access.redhat.com/ubi9/ubi-minimal:latest` | CronJob container image |

### Frontend (`frontend.yaml`)

| Parameter | Default | Description |
|-----------|---------|-------------|
| `FRONTEND_IMAGE` | `quay.io/redhat-services-prod/hcm-eng-prod-tenant/rhai-org-pulse-frontend` | Frontend (nginx) container image |
| `FRONTEND_IMAGE_TAG` | `latest` | Frontend image tag (required) |
| `OAUTH_PROXY_IMAGE` | `quay.io/openshift/origin-oauth-proxy:4.16` | OAuth proxy sidecar image |
| `FRONTEND_REPLICAS` | `1` | Replica count |
| `ROUTE_HOST` | *(empty)* | Frontend route hostname (auto-assigned if empty) |
| `ROUTE_SHARD_LABEL` | *(empty)* | Route `shard` label (e.g. `internal`) |
| `ROUTE_APPCODE_LABEL` | `HPOP-0001` | Route `paas.redhat.com/appcode` label |
| `NGINX_MEMORY_REQUEST` | `32Mi` | Nginx memory request |
| `NGINX_MEMORY_LIMIT` | `64Mi` | Nginx memory limit |
| `NGINX_CPU_REQUEST` | `10m` | Nginx CPU request |
| `NGINX_CPU_LIMIT` | `50m` | Nginx CPU limit |
| `OAUTH_PROXY_MEMORY_REQUEST` | `64Mi` | OAuth proxy memory request |
| `OAUTH_PROXY_MEMORY_LIMIT` | `128Mi` | OAuth proxy memory limit |
| `OAUTH_PROXY_CPU_REQUEST` | `50m` | OAuth proxy CPU request |
| `OAUTH_PROXY_CPU_LIMIT` | `200m` | OAuth proxy CPU limit |

## Required Secrets

Secrets are **not included** in the templates. They must be created in the
namespace before deployment — typically via app-interface `vault-secret`
resources in the namespace YAML.

| Secret Name | Keys | Required? | Used By |
|-------------|------|-----------|---------|
| `jira-api-token` | `JIRA_EMAIL`, `JIRA_TOKEN` | Yes | Backend |
| `github-token` | `GITHUB_TOKEN` | Optional | Backend |
| `gitlab-token` | `GITLAB_TOKEN` | Optional | Backend |
| `ipa-credentials` | `IPA_BIND_DN`, `IPA_BIND_PASSWORD` | Optional | Backend |
| `proxy-auth-secret` | `secret` | Optional | Backend, Frontend, CronJob |
| `frontend-proxy-tls` | `tls.crt`, `tls.key` | Auto-generated | Frontend (via serving-cert annotation) |
| `frontend-proxy-cookie` | `session_secret` | Yes | Frontend (OAuth cookie encryption) |

## SaaS File Example

```yaml
$schema: /app-sre/saas-file-2.yaml
name: rhai-org-pulse
resourceTemplates:
  - name: backend
    url: https://github.com/RedHatInsights/rhai-org-pulse
    path: deploy/templates/backend.yaml
    targets:
      - namespace:
          $ref: /services/org-pulse/namespaces/stage.yml
        ref: <git-sha>
        parameters:
          BACKEND_IMAGE_TAG: <konflux-sha>
          CRONJOB_SUSPEND: "true"
      - namespace:
          $ref: /services/org-pulse/namespaces/prod.yml
        ref: <git-sha>
        parameters:
          BACKEND_IMAGE_TAG: <konflux-sha>
          API_ROUTE_HOST: api-org-pulse.apps.<cluster-domain>
          API_PUBLIC_URL: https://api-org-pulse.apps.<cluster-domain>
          AUTH_EMAIL_DOMAIN: cluster.local
          ADMIN_EMAILS: admin1@redhat.com,admin2@redhat.com
          ROUTE_SHARD_LABEL: internal
          CRONJOB_ADMIN_EMAIL: admin1@redhat.com
  - name: frontend
    url: https://github.com/RedHatInsights/rhai-org-pulse
    path: deploy/templates/frontend.yaml
    targets:
      - namespace:
          $ref: /services/org-pulse/namespaces/stage.yml
        ref: <git-sha>
        parameters:
          FRONTEND_IMAGE_TAG: <konflux-sha>
      - namespace:
          $ref: /services/org-pulse/namespaces/prod.yml
        ref: <git-sha>
        parameters:
          FRONTEND_IMAGE_TAG: <konflux-sha>
          ROUTE_HOST: org-pulse.apps.<cluster-domain>
          ROUTE_SHARD_LABEL: internal
```

## Architecture

```
┌─────────────────────────────────────────────┐
│ OpenShift Route (TLS reencrypt)             │
│ team-tracker                                │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│ Frontend Pod                                 │
│  ┌─────────────────┐  ┌──────────────────┐  │
│  │ OAuth Proxy     │  │ nginx            │  │
│  │ :4180 (HTTPS)   │──│ :8080            │  │
│  │ Sets X-Forwarded│  │ Serves SPA       │  │
│  │ headers         │  │ Proxies /api     │  │
│  └─────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────┘
                       │ /api
┌──────────────────────▼──────────────────────┐
│ Backend Pod                                  │
│  ┌──────────────────────────────────────┐   │
│  │ Express :3001                        │   │
│  │ Jira, GitHub, GitLab, LDAP APIs      │   │
│  └──────────────────────────────────────┘   │
│  Volume: /app/data (PVC: team-tracker-data) │
└─────────────────────────────────────────────┘
```
