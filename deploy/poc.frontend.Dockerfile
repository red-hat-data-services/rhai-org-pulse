# Org Pulse POC — Frontend with org-lens
#
# Extends the core frontend builder with org-lens, builds, then
# serves from the core runtime image.

ARG CORE_TAG=latest

FROM quay.io/org-pulse/org-pulse-core-frontend-builder:${CORE_TAG} AS build

COPY modules/org-lens/ ./modules/org-lens/

RUN npm run build

FROM quay.io/org-pulse/org-pulse-core-frontend-runtime:${CORE_TAG}

COPY --from=build /app/dist /usr/share/nginx/html
