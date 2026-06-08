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

# Collect shared libraries needed by git-remote-https (for HTTPS clone/fetch)
# The runtime image is distroless-like and lacks libcurl + transitive deps
RUN mkdir -p /git-libs && \
    ldd /usr/libexec/git-core/git-remote-https | \
    awk '/=>/ { print $3 }' | \
    grep -v -E '/(libc|libpthread|libdl|libm|librt|libresolv|libnss|libgcc_s|libstdc\+\+)\.' | \
    xargs -I{} cp -L {} /git-libs/

# Trust internal CA
COPY deploy/certs/internal-root-ca.pem /etc/pki/ca-trust/source/anchors/internal-root-ca.pem
RUN update-ca-trust

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: Red Hat Hardened Node.js runtime (distroless-like, minimal CVE surface)
FROM registry.access.redhat.com/hi/nodejs:latest

USER 0

WORKDIR /app

# Copy git binary and libexec helpers from build stage
COPY --from=build /usr/bin/git /usr/bin/git
COPY --from=build /usr/libexec/git-core /usr/libexec/git-core

# Copy shared libraries required by git-remote-https (collected via ldd in build stage)
COPY --from=build /git-libs/ /usr/lib64/

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
