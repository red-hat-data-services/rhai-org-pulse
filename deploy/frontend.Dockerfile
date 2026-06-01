# Stage 1: Build the Vue SPA
FROM registry.access.redhat.com/ubi9/nodejs-20-minimal AS build

USER 0

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.mjs tailwind.config.mjs postcss.config.mjs ./
COPY src/ ./src/
COPY public/ ./public/
COPY shared/client/ ./shared/client/
COPY modules/ ./modules/

RUN npm run build

# Stage 2: Serve with nginx
FROM registry.access.redhat.com/ubi9/nginx-124

# Copy custom nginx location config as a template (envsubst processes it at startup)
COPY deploy/nginx.conf /opt/app-root/etc/nginx.default.d/app.conf.template

# Copy entrypoint script that runs envsubst then starts nginx
COPY deploy/nginx-entrypoint.sh /usr/local/bin/nginx-entrypoint.sh

# Copy built assets
COPY --from=build /app/dist /opt/app-root/src

USER 1001

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/nginx-entrypoint.sh"]
