import { apiRequest } from '@shared/client';

/* eslint-disable-next-line org-pulse/no-cross-module-imports -- approved cross-module API; okr-hub requires releases in module.json */
const BASE = '/modules/releases/delivery/quality';

export async function getVersions() {
  return apiRequest(`${BASE}/versions`);
}

export async function getBugData(versions, component = null) {
  const params = new URLSearchParams({ versions: versions.join(',') });
  if (component) params.set('component', component);
  return apiRequest(`${BASE}/bugs?${params}`);
}

export async function getComponents() {
  return apiRequest(`${BASE}/components`);
}

export async function refreshData() {
  return apiRequest(`${BASE}/refresh`, { method: 'POST' });
}
