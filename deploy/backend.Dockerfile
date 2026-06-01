FROM registry.access.redhat.com/ubi9/nodejs-20-minimal

USER 0

WORKDIR /app

RUN microdnf install -y git ca-certificates && microdnf clean all

# Trust internal CA for git and Node.js HTTPS connections
COPY deploy/certs/internal-root-ca.pem /etc/pki/ca-trust/source/anchors/internal-root-ca.pem
RUN update-ca-trust
ENV NODE_EXTRA_CA_CERTS=/etc/pki/ca-trust/source/anchors/internal-root-ca.pem

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy server code, shared modules, built-in modules, and fixtures
COPY server/ ./server/
COPY shared/server/ ./shared/server/
COPY modules/ ./modules/
COPY fixtures/ ./fixtures/

# Create data directory for PVC mount
RUN mkdir -p /app/data && chown -R 1001:0 /app/data && chmod -R g+rwX /app/data

USER 1001

EXPOSE 3001

ARG GIT_SHA
ARG BUILD_DATE
ENV GIT_SHA=$GIT_SHA
ENV BUILD_DATE=$BUILD_DATE
ENV NODE_ENV=production
ENV API_PORT=3001

CMD ["node", "server/dev-server.js"]
