FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache git

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy server code and data directory structure
COPY server/ ./server/

# Create data directory for PVC mount
RUN mkdir -p /app/data && chown -R 1001:0 /app/data && chmod -R g+rwX /app/data

USER 1001

EXPOSE 3001

ENV NODE_ENV=production
ENV API_PORT=3001

CMD ["node", "server/dev-server.js"]
