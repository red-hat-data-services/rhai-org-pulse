# Org Pulse — AI Engineering Backend
#
# Extends the core backend image with AI Eng-specific modules.
# Core's default CMD (node server/dev-server.js) auto-discovers all
# modules in ./modules/, so no custom entrypoint is needed.

ARG CORE_TAG=latest
FROM quay.io/org-pulse/org-pulse-core-backend:${CORE_TAG}

USER 0

# Install AI Eng-specific runtime dependencies not in core
RUN npm install --no-save @octokit/rest

# Add all non-core modules (core image already has team-tracker)
COPY modules/ ./modules/

# Add all non-core fixtures (core image already has core fixtures)
COPY fixtures/ ./fixtures/

# Add platform customizations
COPY platform/ ./platform/

USER 65532
