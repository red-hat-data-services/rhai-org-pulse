import { ref, computed } from 'vue'

/**
 * Edit panel state management for Big Rock editing.
 * Handles open/close, dirty tracking, and form state.
 */

const isOpen = ref(false)
const editingRock = ref(null)  // null = adding new, object = editing existing
const formData = ref(createEmptyForm())
const saving = ref(false)
const saveError = ref(null)
const fieldErrors = ref({})

function createEmptyForm() {
  return {
    name: '',
    fullName: '',
    pillar: '',
    owner: '',
    architect: '',
    outcomeKeys: [],
    notes: ''
  }
}

export function useBigRockEditor() {
  const isNewRock = computed(function() {
    return editingRock.value === null
  })

  const isDirty = computed(function() {
    if (!editingRock.value) {
      // Adding new -- dirty if any field has content
      return formData.value.name.trim() !== '' ||
        formData.value.fullName.trim() !== '' ||
        formData.value.pillar.trim() !== '' ||
        formData.value.owner.trim() !== '' ||
        formData.value.architect.trim() !== '' ||
        formData.value.outcomeKeys.length > 0 ||
        formData.value.notes.trim() !== ''
    }
    // Editing existing -- dirty if any field differs from original
    const orig = editingRock.value
    return formData.value.owner !== (orig.owner || '') ||
      formData.value.architect !== (orig.architect || '') ||
      JSON.stringify(formData.value.outcomeKeys) !== JSON.stringify(orig.outcomeKeys || []) ||
      formData.value.notes !== (orig.notes || '')
  })

  function openForEdit(rock) {
    editingRock.value = rock
    formData.value = {
      name: rock.name || '',
      fullName: rock.fullName || '',
      pillar: rock.pillar || '',
      owner: rock.owner || '',
      architect: rock.architect || '',
      outcomeKeys: rock.outcomeKeys ? [...rock.outcomeKeys] : [],
      notes: rock.notes || ''
    }
    saving.value = false
    saveError.value = null
    fieldErrors.value = {}
    isOpen.value = true
  }

  function openForNew() {
    editingRock.value = null
    formData.value = createEmptyForm()
    saving.value = false
    saveError.value = null
    fieldErrors.value = {}
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
    editingRock.value = null
    formData.value = createEmptyForm()
    saving.value = false
    saveError.value = null
    fieldErrors.value = {}
  }

  function setSaving(val) {
    saving.value = val
  }

  function setSaveError(err) {
    saveError.value = err
  }

  function setFieldErrors(errors) {
    fieldErrors.value = errors || {}
  }

  return {
    isOpen,
    editingRock,
    formData,
    saving,
    saveError,
    fieldErrors,
    isNewRock,
    isDirty,
    openForEdit,
    openForNew,
    close,
    setSaving,
    setSaveError,
    setFieldErrors
  }
}
