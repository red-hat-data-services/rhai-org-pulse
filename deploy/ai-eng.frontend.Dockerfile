# Org Pulse — AI Engineering Frontend
#
# Extends the core frontend builder with AI Eng modules, builds, then
# serves from the core runtime image.

ARG CORE_TAG=latest

# Stage 1: Build with all AI Eng modules
FROM quay.io/org-pulse/org-pulse-core-frontend-builder:${CORE_TAG} AS build

# Add platform customizations
COPY platform/ ./platform/

# Add AI Eng modules
COPY modules/ai-impact/ ./modules/ai-impact/
COPY modules/releases/ ./modules/releases/
COPY modules/upstream-pulse/ ./modules/upstream-pulse/
COPY modules/product-builds/ ./modules/product-builds/
COPY modules/system-health/ ./modules/system-health/

RUN npm run build

# Stage 2: Serve with hardened nginx
FROM quay.io/org-pulse/org-pulse-core-frontend-runtime:${CORE_TAG}

COPY --from=build /app/dist /usr/share/nginx/html
