<template>
  <div class="space-y-6">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">LDAP Field Discovery</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Discover available LDAP attributes from the directory schema, then enable the ones you want to sync with each person's profile.
        Enabled fields will be populated on the next roster sync.
      </p>

      <div class="flex items-center gap-4 mb-4">
        <button
          @click="handleDiscover"
          :disabled="discovering"
          class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ discovering ? 'Discovering...' : 'Discover Fields' }}
        </button>
        <span v-if="discoveredAt" class="text-sm text-gray-500 dark:text-gray-400">
          Last discovered: {{ new Date(discoveredAt).toLocaleString() }} ({{ discovered.length }} attributes)
        </span>
      </div>

      <div v-if="discoverError" class="mb-4 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-md">
        <p class="text-sm text-red-800 dark:text-red-300">{{ discoverError }}</p>
      </div>
    </div>

    <div v-if="discovered.length > 0" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Available Attributes</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Toggle attributes on to sync them with person profiles. Set a display label for each enabled attribute.
        Attributes already synced by default (name, title, geo, etc.) are shown as locked.
      </p>

      <div class="mb-3">
        <input
          v-model="filterText"
          placeholder="Filter attributes..."
          class="w-full max-w-xs px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>

      <div class="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 dark:bg-gray-900/50">
              <th class="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 w-12">Sync</th>
              <th class="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">LDAP Attribute</th>
              <th class="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">Display Label</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr
              v-for="attr in filteredAttributes"
              :key="attr"
              class="hover:bg-gray-50 dark:hover:bg-gray-900/30"
              :class="isHardcoded(attr) ? 'opacity-50' : ''"
            >
              <td class="px-3 py-2">
                <input
                  v-if="!isHardcoded(attr)"
                  type="checkbox"
                  :checked="isEnabled(attr)"
                  @change="toggleAttribute(attr)"
                  class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                />
                <span v-else class="text-xs text-gray-400 dark:text-gray-500" title="Always synced">🔒</span>
              </td>
              <td class="px-3 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">{{ attr }}</td>
              <td class="px-3 py-2">
                <span v-if="isHardcoded(attr)" class="text-xs text-gray-400 dark:text-gray-500 italic">Always synced</span>
                <input
                  v-else-if="isEnabled(attr)"
                  :value="getLabel(attr)"
                  @input="setLabel(attr, $event.target.value)"
                  placeholder="Display label..."
                  class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="discovered.length > 0" class="flex items-center gap-3">
      <button
        @click="handleSave"
        :disabled="saving"
        class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {{ saving ? 'Saving...' : 'Save Configuration' }}
      </button>
      <span v-if="saveMessage" class="text-sm" :class="saveError ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
        {{ saveMessage }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const baseAttributes = ref(new Set())

const discovered = ref([])
const discoveredAt = ref(null)
const discovering = ref(false)
const discoverError = ref(null)
const enabledFields = ref([])
const filterText = ref('')
const saving = ref(false)
const saveMessage = ref(null)
const saveError = ref(false)

const filteredAttributes = computed(() => {
  const q = filterText.value.toLowerCase()
  if (!q) return discovered.value
  return discovered.value.filter(a => a.toLowerCase().includes(q))
})

function isHardcoded(attr) {
  return baseAttributes.value.has(attr)
}

function isEnabled(attr) {
  return enabledFields.value.some(f => f.attribute === attr)
}

function getLabel(attr) {
  const field = enabledFields.value.find(f => f.attribute === attr)
  return field ? field.label : ''
}

function toggleAttribute(attr) {
  if (isEnabled(attr)) {
    enabledFields.value = enabledFields.value.filter(f => f.attribute !== attr)
  } else {
    enabledFields.value.push({ attribute: attr, label: attr })
  }
}

function setLabel(attr, label) {
  const field = enabledFields.value.find(f => f.attribute === attr)
  if (field) field.label = label
}

async function loadCachedDiscovery() {
  try {
    const data = await apiRequest('/modules/team-tracker/admin/roster-sync/ldap-discover')
    discovered.value = data.discovered || []
    discoveredAt.value = data.discoveredAt || null
    if (Array.isArray(data.baseAttributes)) {
      baseAttributes.value = new Set(data.baseAttributes)
    }
  } catch {
    // Not discovered yet — that's fine
  }
}

async function loadConfig() {
  try {
    const data = await apiRequest('/modules/team-tracker/admin/roster-sync/config')
    if (data.ldapFields && Array.isArray(data.ldapFields.enabled)) {
      enabledFields.value = data.ldapFields.enabled.map(f => ({ ...f }))
    }
  } catch {
    // Config not loaded — that's fine
  }
}

async function handleDiscover() {
  discovering.value = true
  discoverError.value = null
  try {
    const data = await apiRequest('/modules/team-tracker/admin/roster-sync/ldap-discover', {
      method: 'POST'
    })
    discovered.value = data.discovered || []
    discoveredAt.value = data.discoveredAt || null
  } catch (err) {
    discoverError.value = err.message || 'Discovery failed'
  } finally {
    discovering.value = false
  }
}

async function handleSave() {
  saving.value = true
  saveMessage.value = null
  saveError.value = false
  try {
    const enabled = enabledFields.value.filter(f => f.attribute && f.label.trim())
    await apiRequest('/modules/team-tracker/admin/roster-sync/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ldapFields: { enabled }
      })
    })
    saveMessage.value = 'Configuration saved. Enabled fields will sync on the next roster refresh.'
    setTimeout(() => { saveMessage.value = null }, 5000)
  } catch (err) {
    saveMessage.value = err.message
    saveError.value = true
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadCachedDiscovery(), loadConfig()])
})
</script>
