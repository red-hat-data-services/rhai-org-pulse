import { apiRequest } from '@shared/client';

/* eslint-disable-next-line org-pulse/no-cross-module-imports -- approved cross-module API; okr-hub requires releases in module.json */
const BASE = '/modules/releases/delivery/quality';
const OKR_BASE = '/modules/okr-hub/reports';

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

export async function get90DaySummary(config = null) {
  if (config && config.releases && config.releases.length > 0) {
    return apiRequest(`${BASE}/90day-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
  }
  return apiRequest(`${BASE}/90day-summary`);
}

export async function get90DayTrackingConfig() {
  return apiRequest(`${OKR_BASE}/90day-tracking-config`);
}

export async function save90DayTrackingConfig(config) {
  return apiRequest(`${OKR_BASE}/90day-tracking-config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
}
