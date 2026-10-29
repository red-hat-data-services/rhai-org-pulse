# Org Pulse — AI Engineering Frontend
#
# Extends the core frontend builder with AI Eng modules, builds, then
# serves from the core runtime image.

ARG CORE_TAG=latest

# Stage 1: Build with all AI Eng modules
FROM quay.io/org-pulse/org-pulse-core-frontend-builder:${CORE_TAG} AS build

# Install all dependencies (including @org-pulse/core and AI Eng deps) from lockfile
COPY package.json package-lock.json ./
RUN npm ci

# Add platform customizations
COPY platform/ ./platform/

# Add all non-core modules (core builder already has team-tracker)
COPY modules/ ./modules/

# Add public assets (includes AI-First scheduler demo)
COPY public/ ./public/

# Replace /src directory with @org-pulse/core/src for Vite resolution
RUN rm -rf ./src && cp -r ./node_modules/@org-pulse/core/src ./src

RUN npm run build

# Stage 2: Serve with hardened nginx
FROM quay.io/org-pulse/org-pulse-core-frontend-runtime:${CORE_TAG}

COPY --from=build /app/dist /usr/share/nginx/html
