# Org Pulse — AI Engineering Backend
#
# Extends the core backend image with AI Eng-specific modules.
# Core's default CMD (node server/dev-server.js) auto-discovers all
# modules in ./modules/, so no custom entrypoint is needed.

ARG CORE_TAG=latest
FROM quay.io/org-pulse/org-pulse-core-backend:${CORE_TAG}

USER 0

# Copy scripts early since postinstall hook needs it
COPY scripts/ ./scripts/

# Install all dependencies (including @org-pulse/core) from package-lock.json
COPY package.json package-lock.json ./
RUN npm ci

# Install AI Eng-specific runtime dependencies not in core
RUN npm install --no-save @octokit/rest js-yaml express-rate-limit adm-zip xml2js undici@7.29.1

# Add all non-core modules (core image already has team-tracker)
COPY modules/ ./modules/

# Add all non-core fixtures (core image already has core fixtures)
COPY fixtures/ ./fixtures/

# Add platform customizations
COPY platform/ ./platform/

# Replace /src directory with @org-pulse/core/src for Vite resolution
RUN rm -rf ./src && cp -r ./node_modules/@org-pulse/core/src ./src

USER 65532
