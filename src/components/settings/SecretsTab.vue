<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Secrets</h3>
        <p v-if="status" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {{ status.summary.required.configured }}/{{ status.summary.required.total }} required configured,
          {{ status.summary.optional.configured }}/{{ status.summary.optional.total }} optional configured
        </p>
      </div>
      <button
        @click="testAll"
        :disabled="testingAll"
        class="px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
      >
        {{ testingAll ? 'Testing...' : 'Test All Connections' }}
      </button>
    </div>

    <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">Loading secret status...</div>

    <div v-else-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</div>

    <template v-else-if="status">
      <!-- Platform Secrets -->
      <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 mt-4">Platform Secrets</h4>
      <div class="space-y-3 mb-6">
        <SecretGroupCard
          v-for="(group, groupId) in status.platform"
          :key="groupId"
          :title="group.label"
          :secrets="group.secrets"
          :has-validator="hasValidatorForGroup(groupId)"
          :testing="testingGroup === groupId"
          :validation-result="validationResults[groupId]"
          @test="testGroup(groupId)"
        />
      </div>

      <!-- Module Secrets -->
      <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Module Secrets</h4>
      <div class="space-y-3">
        <SecretGroupCard
          v-for="(mod, slug) in status.modules"
          :key="slug"
          :title="slug"
          :secrets="mod.secrets"
          :platform-groups="mod.platform"
          :dynamic="mod.dynamic"
          :exclusive-groups="mod.exclusiveGroups"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import SecretGroupCard from './SecretGroupCard.vue'

const emit = defineEmits(['toast'])

const status = ref(null)
const loading = ref(true)
const error = ref(null)
const testingAll = ref(false)
const testingGroup = ref(null)
const validationResults = ref({})

onMounted(async () => {
  try {
    const data = await apiRequest('/admin/secrets/status')
    status.value = data
  } catch (err) {
    error.value = 'Failed to load secret status: ' + err.message
  } finally {
    loading.value = false
  }
})

function hasValidatorForGroup(groupId) {
  const group = status.value?.platform?.[groupId]
  if (!group) return false
  const validators = status.value?.validators || []
  return group.secrets.some(s => validators.includes(s.key))
}

function getGroupKeys(groupId) {
  const group = status.value?.platform?.[groupId]
  if (!group) return []
  return group.secrets.map(s => s.key)
}

async function testGroup(groupId) {
  testingGroup.value = groupId
  validationResults.value = { ...validationResults.value, [groupId]: null }

  try {
    const keys = getGroupKeys(groupId)
    const data = await apiRequest('/admin/secrets/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys })
    })

    // Aggregate results for the group
    const results = data.results || {}
    const resultKeys = Object.keys(results)
    if (resultKeys.length === 0) {
      validationResults.value = { ...validationResults.value, [groupId]: { valid: true, message: 'No validators registered' } }
    } else {
      const allValid = resultKeys.every(k => results[k].valid)
      const messages = resultKeys.map(k => results[k].message).filter(Boolean)
      validationResults.value = {
        ...validationResults.value,
        [groupId]: { valid: allValid, message: messages.join('; ') || (allValid ? 'OK' : 'Failed') }
      }
    }
  } catch (err) {
    validationResults.value = { ...validationResults.value, [groupId]: { valid: false, message: err.message } }
  } finally {
    testingGroup.value = null
  }
}

async function testAll() {
  testingAll.value = true
  validationResults.value = {}

  try {
    const data = await apiRequest('/admin/secrets/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })

    const results = data.results || {}

    // Map results back to platform groups
    if (status.value?.platform) {
      for (const [groupId, group] of Object.entries(status.value.platform)) {
        const groupKeys = group.secrets.map(s => s.key)
        const groupResults = groupKeys.filter(k => results[k]).map(k => results[k])
        if (groupResults.length > 0) {
          const allValid = groupResults.every(r => r.valid)
          const messages = groupResults.map(r => r.message).filter(Boolean)
          validationResults.value[groupId] = { valid: allValid, message: messages.join('; ') || (allValid ? 'OK' : 'Failed') }
        }
      }
    }

    emit('toast', { type: 'success', message: 'Connection tests complete' })
  } catch (err) {
    emit('toast', { type: 'error', message: 'Test failed: ' + err.message })
  } finally {
    testingAll.value = false
  }
}
</script>
