# Org Pulse Core — Backend
#
# Contains the platform shell + team-tracker module only.
# Other orgs extend this image to add their own modules:
#
#   FROM quay.io/org-pulse/org-pulse-core-backend:v1.x
#   COPY modules/my-module/ ./modules/my-module/
#
# Modules are auto-discovered at startup via filesystem scan.

# Stage 1: Install system deps and node_modules
FROM registry.access.redhat.com/ubi9/nodejs-20-minimal AS build

USER 0

WORKDIR /app

RUN microdnf install -y git-core ca-certificates python3 make gcc gcc-c++ && microdnf clean all

# Trust internal CA
COPY deploy/certs/internal-root-ca.pem /etc/pki/ca-trust/source/anchors/internal-root-ca.pem
RUN update-ca-trust

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: Minimal runtime with only the system packages the app needs at runtime.
# Uses ubi9-minimal (microdnf) so we can install git-core + tar properly with all
# their shared-library dependencies — the distroless hi/nodejs image doesn't have
# a package manager, and copying bare binaries misses transitive .so deps like libcurl.
FROM registry.access.redhat.com/ubi9/nodejs-20-minimal

USER 0

WORKDIR /app

RUN microdnf install -y git-core tar ca-certificates && microdnf clean all

# Copy CA trust bundle (internal CA baked in via update-ca-trust)
COPY --from=build /etc/pki/ca-trust/extracted /etc/pki/ca-trust/extracted
COPY --from=build /etc/pki/ca-trust/source/anchors/internal-root-ca.pem /etc/pki/ca-trust/source/anchors/internal-root-ca.pem
ENV NODE_EXTRA_CA_CERTS=/etc/pki/ca-trust/source/anchors/internal-root-ca.pem

# Copy node_modules from build stage
COPY --from=build /app/node_modules ./node_modules

# Copy server code and shared modules
COPY server/ ./server/
COPY shared/server/ ./shared/server/
COPY package.json ./

# Copy core module only
COPY modules/team-tracker/ ./modules/team-tracker/

# Copy core fixtures (for demo mode)
COPY fixtures/team-data/ ./fixtures/team-data/
COPY fixtures/org-roster/ ./fixtures/org-roster/
COPY fixtures/people/ ./fixtures/people/
COPY fixtures/allocation-tracker/ ./fixtures/allocation-tracker/
COPY fixtures/health-metrics/ ./fixtures/health-metrics/
COPY fixtures/allowlist.json fixtures/api-tokens.json fixtures/audit-log.json ./fixtures/
COPY fixtures/github-contributions.json fixtures/github-history.json ./fixtures/
COPY fixtures/gitlab-contributions.json fixtures/gitlab-history.json ./fixtures/
COPY fixtures/site-config.json ./fixtures/
COPY fixtures/core-modules-state.json ./fixtures/modules-state.json

# Create data directory for PVC mount
RUN mkdir -p /app/data && chown -R 65532:0 /app/data && chmod -R g+rwX /app/data

USER 65532

EXPOSE 3001

ARG GIT_SHA
ARG BUILD_DATE
ENV GIT_SHA=$GIT_SHA
ENV BUILD_DATE=$BUILD_DATE
ENV NODE_ENV=production
ENV API_PORT=3001

CMD ["node", "server/dev-server.js"]
