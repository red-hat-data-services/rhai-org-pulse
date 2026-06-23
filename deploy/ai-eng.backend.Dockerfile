# Org Pulse — AI Engineering Backend
#
# Extends the core backend image with AI Eng-specific modules.

ARG CORE_TAG=latest
FROM quay.io/org-pulse/org-pulse-core-backend:${CORE_TAG}

USER 0

# Add all non-core modules (core image already has team-tracker)
COPY modules/ ./modules/

# Add all non-core fixtures (core image already has core fixtures)
COPY fixtures/ ./fixtures/

USER 65532
