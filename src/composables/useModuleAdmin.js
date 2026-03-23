import { apiAdmin } from '../services/api'

export function useModuleAdmin() {
  async function getAdminModules() {
    return apiAdmin('/admin/modules')
  }

  async function addModule(module) {
    return apiAdmin('/admin/modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(module)
    })
  }

  async function updateModule(slug, updates) {
    return apiAdmin(`/admin/modules/${encodeURIComponent(slug)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
  }

  async function removeModule(slug) {
    return apiAdmin(`/admin/modules/${encodeURIComponent(slug)}`, {
      method: 'DELETE'
    })
  }

  async function triggerSync(slug) {
    return apiAdmin(`/admin/modules/${encodeURIComponent(slug)}/sync`, {
      method: 'POST'
    })
  }

  async function triggerSyncAll() {
    return apiAdmin('/admin/modules/sync', {
      method: 'POST'
    })
  }

  async function getSyncStatus() {
    return apiAdmin('/admin/modules/sync/status')
  }

  return {
    getAdminModules,
    addModule,
    updateModule,
    removeModule,
    triggerSync,
    triggerSyncAll,
    getSyncStatus
  }
}
