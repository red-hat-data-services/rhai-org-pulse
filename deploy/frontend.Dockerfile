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

# Copy custom nginx location config (included by the default server block)
COPY deploy/nginx.conf /opt/app-root/etc/nginx.default.d/app.conf

# Copy built assets
COPY --from=build /app/dist /opt/app-root/src

USER 1001

EXPOSE 8080

CMD ["/usr/libexec/s2i/run"]
