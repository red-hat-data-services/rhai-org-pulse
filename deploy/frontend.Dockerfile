# Stage 1: Build the Vue SPA
FROM registry.access.redhat.com/ubi9/nodejs-20-minimal AS build

USER 0

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts && npm rebuild esbuild

COPY index.html vite.config.mjs tailwind.config.mjs postcss.config.mjs ./
COPY src/ ./src/
COPY public/ ./public/
COPY shared/client/ ./shared/client/
COPY modules/ ./modules/

RUN npm run build

# Stage 2: Serve with Red Hat Hardened nginx (distroless)
FROM registry.access.redhat.com/hi/nginx:latest

COPY deploy/nginx-default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
