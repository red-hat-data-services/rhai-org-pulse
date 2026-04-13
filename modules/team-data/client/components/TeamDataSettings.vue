<script setup>
import { ref, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

const config = ref(null)
const ipa = ref(null)
const loading = ref(true)
const saving = ref(false)
const saveSuccess = ref(false)
const saveError = ref(null)

const syncStatus = ref(null)
const syncing = ref(false)
const testingConnection = ref(false)
const connectionResult = ref(null)

const newOrgRootUid = ref('')
const newOrgRootName = ref('')
const newExcludedTitle = ref('')
const showSyncLog = ref(false)

async function loadConfig() {
  loading.value = true
  try {
    const data = await apiRequest('/modules/team-data/config')
    config.value = data.config
    ipa.value = data.ipa
  } catch {
    config.value = null
  } finally {
    loading.value = false
  }
}

async function loadSyncStatus() {
  try {
    syncStatus.value = await apiRequest('/modules/team-data/sync/status')
  } catch {
    // ignore
  }
}

async function saveConfig() {
  saving.value = true
  saveError.value = null
  saveSuccess.value = false
  try {
    await apiRequest('/modules/team-data/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config.value)
    })
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)
  } catch (e) {
    saveError.value = e.message
  } finally {
    saving.value = false
  }
}

async function testConnection() {
  testingConnection.value = true
  connectionResult.value = null
  try {
    connectionResult.value = await apiRequest('/modules/team-data/ipa/test', { method: 'POST' })
  } catch (e) {
    connectionResult.value = { ok: false, message: e.message }
  } finally {
    testingConnection.value = false
  }
}

async function triggerSync() {
  syncing.value = true
  try {
    await apiRequest('/modules/team-data/sync', { method: 'POST' })
    await loadSyncStatus()
  } catch {
    // ignore
  } finally {
    syncing.value = false
  }
}

function addOrgRoot() {
  if (!newOrgRootUid.value.trim()) return
  if (!config.value.orgRoots) config.value.orgRoots = []
  config.value.orgRoots.push({
    uid: newOrgRootUid.value.trim(),
    name: newOrgRootName.value.trim() || newOrgRootUid.value.trim(),
    displayName: newOrgRootName.value.trim() || newOrgRootUid.value.trim()
  })
  newOrgRootUid.value = ''
  newOrgRootName.value = ''
}

function removeOrgRoot(index) {
  config.value.orgRoots.splice(index, 1)
}

function addExcludedTitle() {
  if (!newExcludedTitle.value.trim()) return
  if (!config.value.excludedTitles) config.value.excludedTitles = []
  config.value.excludedTitles.push(newExcludedTitle.value.trim())
  newExcludedTitle.value = ''
}

function removeExcludedTitle(index) {
  config.value.excludedTitles.splice(index, 1)
}

onMounted(() => {
  loadConfig()
  loadSyncStatus()
})
</script>

<template>
  <div class="space-y-6">
    <div v-if="loading" class="text-gray-500 dark:text-gray-400">Loading configuration...</div>

    <template v-else-if="config">
      <!-- IPA Connection Status -->
      <div>
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">IPA Connection</h4>
        <div class="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-2 text-sm">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full" :class="ipa && ipa.ready ? 'bg-green-500' : 'bg-red-500'"></span>
            <span class="text-gray-700 dark:text-gray-300">{{ ipa && ipa.ready ? 'Credentials configured' : 'Credentials not set' }}</span>
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <div>Host: <span class="font-mono">{{ ipa ? ipa.host : '—' }}</span></div>
            <div>Base DN: <span class="font-mono">{{ ipa ? ipa.baseDn : '—' }}</span></div>
            <div>Bind DN: {{ ipa && ipa.bindDnSet ? 'Set' : 'Not set' }} | Password: {{ ipa && ipa.passwordSet ? 'Set' : 'Not set' }} | CA Cert: {{ ipa && ipa.caCertSet ? 'Set' : 'Not set' }}</div>
          </div>
          <div class="flex items-center gap-3 pt-1">
            <button @click="testConnection" :disabled="testingConnection || !(ipa && ipa.ready)" class="px-3 py-1.5 text-xs bg-gray-800 text-white rounded-md hover:bg-gray-900 disabled:opacity-50">
              {{ testingConnection ? 'Testing...' : 'Test Connection' }}
            </button>
            <span v-if="connectionResult" class="text-xs" :class="connectionResult.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
              {{ connectionResult.message }}
            </span>
          </div>
        </div>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Credentials are set via environment variables (IPA_BIND_DN, IPA_BIND_PASSWORD). Set them in your deployment config.</p>
      </div>

      <!-- Org Roots -->
      <div>
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Org Roots</h4>
        <div class="space-y-2 mb-3">
          <div v-for="(root, i) in config.orgRoots" :key="i" class="flex items-center gap-2 text-sm">
            <span class="font-mono text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{{ root.uid }}</span>
            <span class="text-gray-700 dark:text-gray-300">{{ root.displayName || root.name }}</span>
            <button @click="removeOrgRoot(i)" class="text-red-500 hover:text-red-700 text-xs ml-auto">Remove</button>
          </div>
          <div v-if="!config.orgRoots || config.orgRoots.length === 0" class="text-sm text-gray-400 dark:text-gray-500">No org roots configured</div>
        </div>
        <div class="flex gap-2">
          <input v-model="newOrgRootUid" type="text" placeholder="LDAP UID" class="flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300" />
          <input v-model="newOrgRootName" type="text" placeholder="Display name" class="flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300" />
          <button @click="addOrgRoot" class="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700">Add</button>
        </div>
      </div>

      <!-- Sync Settings -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Grace Period (days)</label>
          <input v-model.number="config.gracePeriodDays" type="number" min="1" max="365" class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300" />
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Days before inactive people are auto-purged</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Auto-Sync</label>
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" v-model="config.autoSync.enabled" class="rounded border-gray-300 dark:border-gray-600" />
              Enabled
            </label>
            <input v-if="config.autoSync.enabled" v-model.number="config.autoSync.intervalHours" type="number" min="1" max="168" class="w-20 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-sm bg-white dark:bg-gray-800 dark:text-gray-300" />
            <span v-if="config.autoSync.enabled" class="text-sm text-gray-500 dark:text-gray-400">hours</span>
          </div>
        </div>
      </div>

      <!-- Excluded Titles -->
      <div>
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Excluded Titles</h4>
        <div class="flex flex-wrap gap-2 mb-2">
          <span v-for="(title, i) in config.excludedTitles" :key="i" class="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-700 dark:text-gray-300">
            {{ title }}
            <button @click="removeExcludedTitle(i)" class="text-gray-400 hover:text-red-500">&times;</button>
          </span>
        </div>
        <div class="flex gap-2">
          <input v-model="newExcludedTitle" type="text" placeholder="Title pattern to exclude" @keyup.enter="addExcludedTitle" class="flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300" />
          <button @click="addExcludedTitle" class="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">Add</button>
        </div>
      </div>

      <!-- Save -->
      <div class="flex items-center gap-3">
        <button @click="saveConfig" :disabled="saving" class="px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 disabled:opacity-50">
          {{ saving ? 'Saving...' : 'Save Configuration' }}
        </button>
        <span v-if="saveSuccess" class="text-green-600 dark:text-green-400 text-sm">Saved successfully</span>
        <span v-if="saveError" class="text-red-600 dark:text-red-400 text-sm">{{ saveError }}</span>
      </div>

      <!-- Sync -->
      <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Data Sync</h4>
        <div class="flex items-center gap-3">
          <button @click="triggerSync" :disabled="syncing" class="px-4 py-2 bg-gray-800 text-white rounded-md text-sm hover:bg-gray-900 disabled:opacity-50">
            {{ syncing ? 'Syncing...' : 'Sync Now' }}
          </button>
          <div v-if="syncStatus && syncStatus.lastResult" class="text-sm text-gray-500 dark:text-gray-400">
            Last sync:
            <span :class="syncStatus.lastResult.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
              {{ syncStatus.lastResult.status }}
            </span>
            <span v-if="syncStatus.lastResult.completedAt"> at {{ new Date(syncStatus.lastResult.completedAt).toLocaleString() }}</span>
            <button @click="showSyncLog = !showSyncLog" class="ml-2 text-primary-600 dark:text-primary-400 text-xs hover:underline">
              {{ showSyncLog ? 'Hide log' : 'Show log' }}
            </button>
          </div>
        </div>

        <!-- Sync Log -->
        <div v-if="showSyncLog && syncStatus && syncStatus.lastResult && syncStatus.lastResult.summary" class="mt-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 text-sm space-y-2">
          <div class="grid grid-cols-3 gap-2">
            <div>Total: <span class="font-medium">{{ syncStatus.lastResult.summary.total }}</span></div>
            <div>Active: <span class="font-medium">{{ syncStatus.lastResult.summary.active }}</span></div>
            <div>Inactive: <span class="font-medium">{{ syncStatus.lastResult.summary.inactive }}</span></div>
          </div>
          <div v-if="syncStatus.lastResult.summary.joined.length > 0" class="text-green-600 dark:text-green-400">
            Joined: {{ syncStatus.lastResult.summary.joined.join(', ') }}
          </div>
          <div v-if="syncStatus.lastResult.summary.left.length > 0" class="text-red-600 dark:text-red-400">
            Left: {{ syncStatus.lastResult.summary.left.join(', ') }}
          </div>
          <div v-if="syncStatus.lastResult.summary.changed.length > 0">
            <div class="text-gray-500 dark:text-gray-400 mb-1">Changes:</div>
            <div v-for="(change, i) in syncStatus.lastResult.summary.changed.slice(0, 20)" :key="i" class="text-xs text-gray-600 dark:text-gray-400">
              {{ change.uid }}: {{ change.field }} {{ change.from }} &rarr; {{ change.to }}
            </div>
            <div v-if="syncStatus.lastResult.summary.changed.length > 20" class="text-xs text-gray-400">
              ...and {{ syncStatus.lastResult.summary.changed.length - 20 }} more
            </div>
          </div>
          <div v-if="syncStatus.lastResult.duration" class="text-xs text-gray-400">
            Duration: {{ (syncStatus.lastResult.duration / 1000).toFixed(1) }}s
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
