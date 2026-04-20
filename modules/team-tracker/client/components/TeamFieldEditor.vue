<script setup>
import { ref, computed, watch } from 'vue'
import { useTeams } from '@shared/client/composables/useTeams'

const props = defineProps({
  teamId: { type: String, required: true },
  metadata: { type: Object, default: () => ({}) },
  fieldDefinitions: { type: Array, default: () => [] },
  canEdit: { type: Boolean, default: false }
})

const emit = defineEmits(['updated'])

const { demoToast, updateTeamFields } = useTeams()

const editingFieldId = ref(null)
const editValue = ref('')
const saving = ref(false)
const demoInfo = ref(null)

watch(demoToast, (msg) => {
  if (msg) { demoInfo.value = msg; setTimeout(() => { demoInfo.value = null }, 3000) }
})

const visibleFields = computed(() =>
  props.fieldDefinitions.filter(f => f.visible && !f.deleted)
)

function startEdit(fieldId) {
  editingFieldId.value = fieldId
  editValue.value = props.metadata[fieldId] || ''
}

async function saveEdit(fieldId) {
  saving.value = true
  try {
    await updateTeamFields(props.teamId, { [fieldId]: editValue.value || null })
    editingFieldId.value = null
    emit('updated')
  } catch {
    // Error handled by composable
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-y-2">
    <div v-if="demoInfo" class="p-2 bg-blue-50 border border-blue-200 rounded text-blue-700 text-xs">
      {{ demoInfo }}
    </div>
    <div v-for="field in visibleFields" :key="field.id" class="flex items-center gap-2">
      <span class="text-sm text-gray-600 w-32 shrink-0">{{ field.label }}:</span>
      <template v-if="editingFieldId === field.id">
        <input
          v-model="editValue"
          class="flex-1 rounded border-gray-300 text-sm"
          @keyup.enter="saveEdit(field.id)"
          @keyup.escape="editingFieldId = null"
        >
        <button class="text-xs text-primary-600" :disabled="saving" @click="saveEdit(field.id)">Save</button>
        <button class="text-xs text-gray-500" @click="editingFieldId = null">Cancel</button>
      </template>
      <template v-else>
        <span class="text-sm text-gray-900 flex-1">{{ metadata[field.id] || '-' }}</span>
        <button
          v-if="canEdit"
          class="text-xs text-gray-400 hover:text-gray-600"
          @click="startEdit(field.id)"
        >Edit</button>
      </template>
    </div>
  </div>
</template>
