# Stage 1: Install system deps and node_modules
FROM registry.access.redhat.com/hi/nodejs:latest AS build

USER 0

WORKDIR /app

RUN microdnf install -y git-core ca-certificates python3 make gcc gcc-c++ && microdnf clean all

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

# Copy CA trust bundle (internal CA baked in via update-ca-trust)
COPY --from=build /etc/pki/ca-trust/extracted /etc/pki/ca-trust/extracted
COPY --from=build /etc/pki/ca-trust/source/anchors/internal-root-ca.pem /etc/pki/ca-trust/source/anchors/internal-root-ca.pem
ENV NODE_EXTRA_CA_CERTS=/etc/pki/ca-trust/source/anchors/internal-root-ca.pem

# Copy node_modules from build stage
COPY --from=build /app/node_modules ./node_modules

# Copy server code, shared modules, built-in modules, and fixtures
COPY server/ ./server/
COPY shared/server/ ./shared/server/
COPY modules/ ./modules/
COPY fixtures/ ./fixtures/
COPY package.json ./

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
