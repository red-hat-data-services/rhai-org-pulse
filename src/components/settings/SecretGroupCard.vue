<template>
  <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
    <div class="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800">
      <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ title }}</h4>
      <div class="flex items-center gap-2">
        <template v-if="validationResult">
          <span v-if="validationResult.valid" class="text-green-600 dark:text-green-400 text-xs flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            {{ validationResult.message || 'OK' }}
          </span>
          <span v-else class="text-red-600 dark:text-red-400 text-xs flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            {{ validationResult.message || 'Failed' }}
          </span>
        </template>
        <button
          v-if="hasValidator"
          @click="$emit('test')"
          :disabled="testing"
          class="text-xs px-3 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {{ testing ? 'Testing...' : 'Test' }}
        </button>
      </div>
    </div>
    <div class="divide-y divide-gray-100 dark:divide-gray-700">
      <template v-for="(secretGroup, gIdx) in groupedSecrets" :key="gIdx">
        <template v-if="secretGroup.exclusive">
          <div class="px-4 py-2">
            <template v-for="(secret, sIdx) in secretGroup.secrets" :key="secret.key">
              <div class="flex items-center justify-between py-1">
                <div>
                  <code class="text-xs font-mono text-gray-800 dark:text-gray-200">{{ secret.key }}</code>
                  <p v-if="secret.description" class="text-xs text-gray-500 dark:text-gray-400">{{ secret.description }}</p>
                </div>
                <SecretStatusBadge :configured="secret.configured" :required="secret.required" />
              </div>
              <div v-if="sIdx < secretGroup.secrets.length - 1" class="text-center text-xs text-gray-400 dark:text-gray-500 py-1">-- OR --</div>
            </template>
          </div>
        </template>
        <template v-else>
          <div v-for="secret in secretGroup.secrets" :key="secret.key" class="flex items-center justify-between px-4 py-2">
            <div>
              <code class="text-xs font-mono text-gray-800 dark:text-gray-200">{{ secret.key }}</code>
              <p v-if="secret.description" class="text-xs text-gray-500 dark:text-gray-400">{{ secret.description }}</p>
            </div>
            <SecretStatusBadge :configured="secret.configured" :required="secret.required" />
          </div>
        </template>
      </template>
      <div v-if="platformGroups && platformGroups.length > 0" class="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
        Platform: {{ platformGroups.join(', ') }}
      </div>
      <div v-if="dynamic" class="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
        Dynamic: {{ dynamic.pattern }} ({{ dynamic.description || 'per-instance' }})
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import SecretStatusBadge from './SecretStatusBadge.vue'

const props = defineProps({
  title: { type: String, required: true },
  secrets: { type: Array, default: () => [] },
  platformGroups: { type: Array, default: null },
  dynamic: { type: Object, default: null },
  exclusiveGroups: { type: Object, default: null },
  hasValidator: { type: Boolean, default: false },
  testing: { type: Boolean, default: false },
  validationResult: { type: Object, default: null }
})

defineEmits(['test'])

const groupedSecrets = computed(() => {
  const groups = []
  const exclusiveGroupMap = props.exclusiveGroups || {}
  const processedKeys = new Set()

  // Handle exclusive groups
  for (const [_groupName, groupData] of Object.entries(exclusiveGroupMap)) {
    if (!groupData.members || groupData.members.length === 0) continue
    const groupSecrets = props.secrets.filter(s => groupData.members.includes(s.key))
    if (groupSecrets.length > 0) {
      groups.push({ exclusive: true, secrets: groupSecrets })
      for (const s of groupSecrets) processedKeys.add(s.key)
    }
  }

  // Remaining secrets (non-exclusive)
  const remaining = props.secrets.filter(s => !processedKeys.has(s.key))
  if (remaining.length > 0) {
    groups.push({ exclusive: false, secrets: remaining })
  }

  return groups
})
</script>
