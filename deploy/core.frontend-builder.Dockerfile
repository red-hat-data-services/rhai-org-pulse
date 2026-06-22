# Org Pulse Core — Frontend Builder
#
# Build stage with all dependencies installed and core source copied.
# Does NOT run `npm run build` — extending images add their modules then build.
#
# Usage for orgs adding custom modules:
#
#   FROM quay.io/org-pulse/org-pulse-core-frontend-builder:v1.x AS build
#   COPY modules/my-module/ ./modules/my-module/
#   RUN npm run build
#
#   FROM quay.io/org-pulse/org-pulse-core-frontend-runtime:v1.x
#   COPY --from=build /app/dist /usr/share/nginx/html

FROM registry.access.redhat.com/ubi9/nodejs-22-minimal

USER 0

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.mjs tailwind.config.mjs postcss.config.mjs ./
COPY src/ ./src/
COPY public/ ./public/
COPY shared/client/ ./shared/client/

# Core module only
COPY modules/team-tracker/ ./modules/team-tracker/
