# Stage 1: Install dependencies
# Use the same Node.js image as runtime so prebuild-install downloads
# the correct prebuilt binary for native modules (better-sqlite3).
FROM registry.access.redhat.com/hi/nodejs:latest AS build

USER 0

WORKDIR /app

# Install git for any git-based deps (hi/nodejs is minimal but has npm)
# No gcc/python needed — better-sqlite3 ships prebuilt binaries for Node 26

# Trust internal CA
COPY deploy/certs/internal-root-ca.pem /etc/pki/ca-trust/source/anchors/internal-root-ca.pem
ENV NODE_EXTRA_CA_CERTS=/etc/pki/ca-trust/source/anchors/internal-root-ca.pem

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Stage 2: Red Hat Hardened Node.js runtime (distroless-like, minimal CVE surface)
FROM registry.access.redhat.com/hi/nodejs:latest

USER 0

WORKDIR /app

# Copy CA trust bundle
COPY deploy/certs/internal-root-ca.pem /etc/pki/ca-trust/source/anchors/internal-root-ca.pem
ENV NODE_EXTRA_CA_CERTS=/etc/pki/ca-trust/source/anchors/internal-root-ca.pem

# Copy node_modules from build stage (native modules have correct ABI)
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
