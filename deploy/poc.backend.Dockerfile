# Org Pulse POC — Backend with org-lens
#
# Extends the core backend image with the org-lens chatbot module.

ARG CORE_TAG=latest
FROM quay.io/org-pulse/org-pulse-core-backend:${CORE_TAG}

USER 0

COPY modules/org-lens/ ./modules/org-lens/
COPY fixtures/org-lens/ ./fixtures/org-lens/

RUN npm install @google/generative-ai

USER 65532
