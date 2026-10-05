import { apiRequest } from '@shared/client';

const BASE = '/modules/releases/delivery/quality';
const OKR_BASE = '/modules/okr-hub/reports';

export async function getVersions() {
  return apiRequest(`${BASE}/versions`);
}

export async function getBugData(versions, components = [], priorities = []) {
  const params = new URLSearchParams({ versions: versions.join(',') });
  if (components.length > 0) params.set('component', components.join(','));
  if (priorities.length > 0) params.set('priority', priorities.join(','));
  return apiRequest(`${BASE}/bugs?${params}`);
}

export async function getComponents() {
  return apiRequest(`${BASE}/components`);
}

export async function getPriorities() {
  return apiRequest(`${BASE}/priorities`);
}

export async function refreshData() {
  return apiRequest(`${BASE}/refresh`, { method: 'POST' });
}

export async function get90DaySummary(config = null) {
  const payload = config && Array.isArray(config.releases) ? config : { releases: [] };
  return apiRequest(`${BASE}/90day-summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
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
