<template>
  <div class="space-y-8">
    <!-- User Type Field Configuration -->
    <section>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">User Type Field</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Select which person-level field determines the "user type" dimension in analytics.
      </p>
      <div class="flex items-center gap-3">
        <select
          v-model="selectedFieldId"
          class="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white text-sm min-w-[200px]"
        >
          <option :value="null">None (all users shown as "unknown")</option>
          <option v-for="field in personFields" :key="field.id" :value="field.id">
            {{ field.label }}
          </option>
        </select>
        <button
          @click="saveFieldConfig"
          :disabled="saving"
          class="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </section>

    <!-- Retention Configuration -->
    <section>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Data Retention</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Raw event data older than this will be pruned (aggregates are kept indefinitely).
      </p>
      <div class="flex items-center gap-3">
        <input
          type="number"
          v-model.number="retentionDays"
          min="30"
          max="365"
          class="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white text-sm w-24"
        />
        <span class="text-sm text-gray-500 dark:text-gray-400">days (30–365)</span>
        <button
          @click="saveRetentionConfig"
          :disabled="saving"
          class="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </section>

    <!-- Viewer Role Management -->
    <section>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Dashboard Viewers</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Assign the <code class="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">usage-metrics-viewer</code> role to non-admin users who should see the dashboard.
      </p>

      <div class="flex items-center gap-2 mb-4">
        <input
          v-model="newViewerEmail"
          type="email"
          placeholder="email@redhat.com"
          class="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white text-sm flex-1 max-w-md"
          @keydown.enter="assignViewer"
        />
        <button
          @click="assignViewer"
          :disabled="!newViewerEmail"
          class="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          Assign Role
        </button>
      </div>

      <ul v-if="viewers.length" class="space-y-2">
        <li
          v-for="viewer in viewers"
          :key="viewer.email"
          class="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg"
        >
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ viewer.email }}</span>
          <button
            @click="revokeViewer(viewer.email)"
            class="text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Revoke
          </button>
        </li>
      </ul>
      <p v-else class="text-sm text-gray-400 dark:text-gray-500 italic">No viewers assigned. Only admins can access the dashboard.</p>
    </section>

    <!-- Data Management -->
    <section>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Data Management</h3>
      <div class="flex items-center gap-3">
        <button
          @click="regenerateAggregates"
          :disabled="saving"
          class="px-4 py-2 text-sm font-medium bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
        >
          Regenerate Aggregates
        </button>
        <button
          @click="purgeEvents"
          :disabled="saving"
          class="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          Purge Raw Events
        </button>
      </div>
    </section>

    <div v-if="message" class="text-sm" :class="messageIsError ? 'text-red-600' : 'text-green-600'">
      {{ message }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { apiRequest } from '@shared/client'

const selectedFieldId = ref(null)
const retentionDays = ref(90)
const personFields = ref([])
const viewers = ref([])
const newViewerEmail = ref('')
const saving = ref(false)
const message = ref('')
const messageIsError = ref(false)

function showMessage(msg, isError = false) {
  message.value = msg
  messageIsError.value = isError
  setTimeout(() => { message.value = '' }, 5000)
}

async function loadConfig() {
  try {
    const config = await apiRequest('/modules/health-metrics/config')
    selectedFieldId.value = config.userTypeFieldId || null
    retentionDays.value = config.retentionDays || 90
  } catch { /* ignore */ }
}

async function loadFieldDefinitions() {
  try {
    const data = await apiRequest('/modules/health-metrics/field-definitions')
    personFields.value = data.person || []
  } catch { /* ignore */ }
}

async function loadViewers() {
  try {
    const data = await apiRequest('/roles')
    const allRoles = data.roles || data || {}
    viewers.value = Object.entries(allRoles)
      .filter(([, roles]) => Array.isArray(roles) && roles.includes('usage-metrics-viewer'))
      .map(([email]) => ({ email }))
  } catch { /* ignore */ }
}

async function saveFieldConfig() {
  saving.value = true
  try {
    await apiRequest('/modules/health-metrics/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userTypeFieldId: selectedFieldId.value }),
    })
    showMessage('User type field updated.')
  } catch (err) {
    showMessage(err.message || 'Failed to save', true)
  } finally {
    saving.value = false
  }
}

async function saveRetentionConfig() {
  saving.value = true
  try {
    await apiRequest('/modules/health-metrics/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ retentionDays: retentionDays.value }),
    })
    showMessage('Retention period updated.')
  } catch (err) {
    showMessage(err.message || 'Failed to save', true)
  } finally {
    saving.value = false
  }
}

async function assignViewer() {
  if (!newViewerEmail.value) return
  try {
    await apiRequest('/roles/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newViewerEmail.value, role: 'usage-metrics-viewer' }),
    })
    newViewerEmail.value = ''
    showMessage('Viewer role assigned.')
    await loadViewers()
  } catch (err) {
    showMessage(err.message || 'Failed to assign role', true)
  }
}

async function revokeViewer(email) {
  try {
    await apiRequest('/roles/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role: 'usage-metrics-viewer' }),
    })
    showMessage('Viewer role revoked.')
    await loadViewers()
  } catch (err) {
    showMessage(err.message || 'Failed to revoke role', true)
  }
}

async function regenerateAggregates() {
  saving.value = true
  try {
    const data = await apiRequest('/modules/health-metrics/aggregate', { method: 'POST' })
    showMessage(`Regenerated ${data.generated} aggregate(s).`)
  } catch (err) {
    showMessage(err.message || 'Failed to regenerate', true)
  } finally {
    saving.value = false
  }
}

async function purgeEvents() {
  if (!confirm('This will delete all raw event data. Aggregates will be kept. Continue?')) return
  saving.value = true
  try {
    await apiRequest('/modules/health-metrics/events', { method: 'DELETE' })
    showMessage('Raw events purged.')
  } catch (err) {
    showMessage(err.message || 'Failed to purge', true)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadConfig()
  loadFieldDefinitions()
  loadViewers()
})
</script>
