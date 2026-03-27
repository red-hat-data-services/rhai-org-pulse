FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache git ca-certificates

# Trust internal CA for git and Node.js HTTPS connections
COPY deploy/certs/internal-root-ca.pem /usr/local/share/ca-certificates/internal-root-ca.crt
RUN update-ca-certificates
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/internal-root-ca.crt

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy server code, shared modules, and built-in modules
COPY server/ ./server/
COPY shared/server/ ./shared/server/
COPY modules/ ./modules/

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
