import { ref } from 'vue'
import { apiRequest } from '@shared/client/services/api'

function isDemoResponse(data) {
  return data && data.demo === true
}

export function useFieldDefinitions() {
  const definitions = ref({ personFields: [], teamFields: [] })
  const loading = ref(false)
  const demoToast = ref(null)

  async function fetchDefinitions() {
    loading.value = true
    try {
      const data = await apiRequest('/modules/team-tracker/structure/field-definitions')
      definitions.value = data
    } catch {
      definitions.value = { personFields: [], teamFields: [] }
    } finally {
      loading.value = false
    }
  }

  async function createField(scope, definition) {
    const result = await apiRequest(`/modules/team-tracker/structure/field-definitions/${scope}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(definition)
    })
    if (isDemoResponse(result)) { demoToast.value = result.message; return result }
    definitions.value[scope === 'person' ? 'personFields' : 'teamFields'].push(result)
    return result
  }

  async function updateField(scope, fieldId, updates) {
    const result = await apiRequest(`/modules/team-tracker/structure/field-definitions/${scope}/${fieldId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    if (isDemoResponse(result)) { demoToast.value = result.message; return result }
    const key = scope === 'person' ? 'personFields' : 'teamFields'
    const idx = definitions.value[key].findIndex(f => f.id === fieldId)
    if (idx !== -1) definitions.value[key][idx] = result
    return result
  }

  async function deleteField(scope, fieldId) {
    const result = await apiRequest(`/modules/team-tracker/structure/field-definitions/${scope}/${fieldId}`, {
      method: 'DELETE'
    })
    if (isDemoResponse(result)) { demoToast.value = result.message; return result }
    const key = scope === 'person' ? 'personFields' : 'teamFields'
    const idx = definitions.value[key].findIndex(f => f.id === fieldId)
    if (idx !== -1) definitions.value[key][idx].deleted = true
    return result
  }

  async function reorderFields(scope, orderedIds) {
    const result = await apiRequest(`/modules/team-tracker/structure/field-definitions/${scope}/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds })
    })
    if (isDemoResponse(result)) { demoToast.value = result.message; return result }
    return result
  }

  async function updatePersonFields(uid, fieldValues) {
    const result = await apiRequest(`/modules/team-tracker/structure/person/${uid}/fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fieldValues)
    })
    if (isDemoResponse(result)) { demoToast.value = result.message; return result }
    return result
  }

  return {
    definitions,
    loading,
    demoToast,
    fetchDefinitions,
    createField,
    updateField,
    deleteField,
    reorderFields,
    updatePersonFields
  }
}
