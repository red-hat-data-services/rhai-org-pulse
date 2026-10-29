# Org Pulse — AI Engineering Frontend
#
# Extends the core frontend builder with AI Eng modules, builds, then
# serves from the core runtime image.

ARG CORE_TAG=latest

# Stage 1: Build with all AI Eng modules
FROM quay.io/org-pulse/org-pulse-core-frontend-builder:${CORE_TAG} AS build

# Install all dependencies (including @org-pulse/core) from package-lock.json
COPY package.json package-lock.json ./
RUN npm ci

# Install AI Eng-specific frontend dependencies (core deps already present)
RUN npm install --no-save mermaid @dagrejs/dagre @vue-flow/core @vue-flow/background @vue-flow/controls @vue-flow/minimap

# Add platform customizations
COPY platform/ ./platform/

# Add all non-core modules (core builder already has team-tracker)
COPY modules/ ./modules/

# Add public assets (includes AI-First scheduler demo)
COPY public/ ./public/

# Copy /src directory from @org-pulse/core (more reliable than symlinking in Docker)
RUN cp -r ./node_modules/@org-pulse/core/src ./src

RUN npm run build

# Stage 2: Serve with hardened nginx
FROM quay.io/org-pulse/org-pulse-core-frontend-runtime:${CORE_TAG}

COPY --from=build /app/dist /usr/share/nginx/html
