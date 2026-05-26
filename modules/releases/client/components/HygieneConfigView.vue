<template>
  <div class="max-w-4xl mx-auto">
    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-gray-500 dark:text-gray-400">Loading hygiene configuration...</div>

    <!-- Error -->
    <div v-else-if="loadError" class="text-center py-12">
      <p class="text-red-600 dark:text-red-400">{{ loadError }}</p>
      <button @click="fetchConfig" class="mt-3 text-sm text-primary-600 hover:text-primary-700">Retry</button>
    </div>

    <template v-else>
      <!-- Status message -->
      <div
        v-if="statusMessage"
        class="mb-4 p-3 rounded-lg text-sm"
        :class="statusError
          ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'"
      >
        {{ statusMessage }}
      </div>

      <!-- Rules by category -->
      <div class="space-y-4 mb-8">
        <div
          v-for="category in groupedCategories"
          :key="category.key"
          class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
        >
          <button
            @click="toggleCategory(category.key)"
            class="w-full flex items-center justify-between px-5 py-3 text-left"
          >
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {{ category.label }}
              <span class="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">
                ({{ category.rules.length }} rule{{ category.rules.length !== 1 ? 's' : '' }})
              </span>
            </h3>
            <svg
              class="h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform"
              :class="{ 'rotate-180': expandedCategories[category.key] }"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div v-show="expandedCategories[category.key]" class="border-t border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
            <div
              v-for="rule in category.rules"
              :key="rule.id"
              class="px-5 py-4 flex items-start gap-4"
            >
              <!-- Toggle -->
              <button
                @click="toggleRule(rule.id)"
                class="relative mt-0.5 flex-shrink-0 inline-flex h-5 w-9 items-center rounded-full transition-colors"
                :class="ruleConfig(rule.id).enabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'"
                role="switch"
                :aria-checked="ruleConfig(rule.id).enabled"
              >
                <span
                  class="inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform"
                  :class="ruleConfig(rule.id).enabled ? 'translate-x-4' : 'translate-x-0.5'"
                />
              </button>

              <!-- Rule info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ rule.name }}</span>
                  <span
                    v-if="rule.remediation"
                    class="group relative cursor-help"
                    :title="rule.remediation"
                  >
                    <svg class="h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ rule.description }}</p>

                <!-- Threshold input -->
                <div v-if="rule.defaultThreshold != null" class="mt-2 flex items-center gap-2">
                  <label :for="'threshold-' + rule.id" class="text-xs text-gray-500 dark:text-gray-400">Threshold:</label>
                  <input
                    :id="'threshold-' + rule.id"
                    type="number"
                    min="1"
                    :value="ruleConfig(rule.id).threshold ?? rule.defaultThreshold"
                    @input="updateThreshold(rule.id, $event.target.value)"
                    class="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <span class="text-xs text-gray-400 dark:text-gray-500">days</span>
                </div>

                <!-- Grandfathered releases for missing-rice-score -->
                <div v-if="rule.id === 'missing-rice-score'" class="mt-2">
                  <label :for="'gf-' + rule.id" class="text-xs text-gray-500 dark:text-gray-400 block mb-1">Grandfathered releases (exempt from this rule):</label>
                  <input
                    :id="'gf-' + rule.id"
                    type="text"
                    :value="(ruleConfig(rule.id).grandfatheredReleases || []).join(', ')"
                    @input="updateGrandfathered(rule.id, $event.target.value)"
                    placeholder="e.g. rhoai-2.14, rhoai-2.15"
                    class="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Projects & Issue Types -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-5 mb-6">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Scope</h3>
        <div class="space-y-4">
          <div>
            <label for="hygiene-projects" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Projects</label>
            <input
              id="hygiene-projects"
              type="text"
              v-model="projectsInput"
              placeholder="Comma-separated, e.g. RHOAIENG, RHODS"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label for="hygiene-types" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Issue Types</label>
            <input
              id="hygiene-types"
              type="text"
              v-model="issueTypesInput"
              placeholder="Comma-separated, e.g. Feature, Epic"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>
      </div>

      <!-- Save button -->
      <div class="flex items-center gap-4 mb-8">
        <button
          @click="handleSave"
          :disabled="saving || !hasChanges"
          class="px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ saving ? 'Saving...' : 'Save Configuration' }}
        </button>
      </div>

      <!-- Refresh section -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-5">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Refresh Hygiene Data</h3>
        <div class="flex items-center gap-3">
          <select
            v-model="selectedVersion"
            class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Select version...</option>
            <option v-for="v in versions" :key="v" :value="v">{{ v }}</option>
          </select>
          <button
            @click="handleRefresh"
            :disabled="refreshing || !selectedVersion"
            class="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ refreshing ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>
        <p v-if="refreshStatus" class="mt-3 text-sm text-gray-500 dark:text-gray-400">
          {{ refreshStatus }}
        </p>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const statusMessage = ref('')
const statusError = ref(false)

// Rule definitions from the server
const ruleDefinitions = ref([])

// Editable config state
const editableRules = reactive({})
const projectsInput = ref('')
const issueTypesInput = ref('')

// Original snapshot for dirty detection
const originalSnapshot = ref('')

// Category collapse state
const expandedCategories = reactive({})

// Refresh state
const versions = ref([])
const selectedVersion = ref('')
const refreshing = ref(false)
const refreshStatus = ref('')
let refreshPollId = null

const hasChanges = computed(() => {
  return JSON.stringify(buildConfigPayload()) !== originalSnapshot.value
})

const groupedCategories = computed(() => {
  const groups = {}
  for (const rule of ruleDefinitions.value) {
    const key = rule.category || 'other'
    if (!groups[key]) {
      groups[key] = { key, label: rule.categoryLabel || key, rules: [] }
    }
    groups[key].rules.push(rule)
  }
  return Object.values(groups)
})

function ruleConfig(ruleId) {
  if (!editableRules[ruleId]) {
    const def = ruleDefinitions.value.find(r => r.id === ruleId)
    editableRules[ruleId] = {
      enabled: def?.defaultEnabled ?? false,
      threshold: def?.defaultThreshold ?? undefined,
      grandfatheredReleases: undefined,
    }
  }
  return editableRules[ruleId]
}

function toggleRule(ruleId) {
  const cfg = ruleConfig(ruleId)
  cfg.enabled = !cfg.enabled
}

function updateThreshold(ruleId, value) {
  const cfg = ruleConfig(ruleId)
  cfg.threshold = value ? Number(value) : undefined
}

function updateGrandfathered(ruleId, value) {
  const cfg = ruleConfig(ruleId)
  cfg.grandfatheredReleases = value.split(',').map(s => s.trim()).filter(Boolean)
}

function toggleCategory(key) {
  expandedCategories[key] = !expandedCategories[key]
}

function buildConfigPayload() {
  const rules = {}
  for (const [id, cfg] of Object.entries(editableRules)) {
    const entry = { enabled: cfg.enabled }
    if (cfg.threshold != null) entry.threshold = cfg.threshold
    if (cfg.grandfatheredReleases?.length) entry.grandfatheredReleases = cfg.grandfatheredReleases
    rules[id] = entry
  }
  return {
    rules,
    projects: projectsInput.value.split(',').map(s => s.trim()).filter(Boolean),
    issueTypes: issueTypesInput.value.split(',').map(s => s.trim()).filter(Boolean),
  }
}

function takeSnapshot() {
  originalSnapshot.value = JSON.stringify(buildConfigPayload())
}

async function fetchConfig() {
  loading.value = true
  loadError.value = ''
  try {
    const data = await apiRequest('/modules/releases/hygiene/config')
    ruleDefinitions.value = data.ruleDefinitions || []
    const config = data.config || {}

    // Populate editable state from saved config
    for (const rule of ruleDefinitions.value) {
      const saved = config.rules?.[rule.id]
      editableRules[rule.id] = {
        enabled: saved?.enabled ?? rule.defaultEnabled ?? false,
        threshold: saved?.threshold ?? rule.defaultThreshold ?? undefined,
        grandfatheredReleases: saved?.grandfatheredReleases ?? undefined,
      }
    }

    projectsInput.value = (config.projects || []).join(', ')
    issueTypesInput.value = (config.issueTypes || []).join(', ')

    // Expand all categories by default
    for (const rule of ruleDefinitions.value) {
      const key = rule.category || 'other'
      if (!(key in expandedCategories)) {
        expandedCategories[key] = true
      }
    }

    takeSnapshot()
  } catch (e) {
    loadError.value = e.message || 'Failed to load hygiene configuration.'
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  saving.value = true
  statusMessage.value = ''
  statusError.value = false
  try {
    await apiRequest('/modules/releases/hygiene/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildConfigPayload()),
    })
    statusMessage.value = 'Configuration saved successfully.'
    statusError.value = false
    takeSnapshot()
  } catch (e) {
    statusMessage.value = e.message || 'Failed to save configuration.'
    statusError.value = true
  } finally {
    saving.value = false
  }
}

async function fetchVersions() {
  try {
    const data = await apiRequest('/modules/releases/execution/versions')
    versions.value = data.versions || data || []
  } catch {
    // Non-critical — version selector just stays empty
  }
}

async function handleRefresh() {
  refreshing.value = true
  refreshStatus.value = 'Starting refresh...'
  try {
    await apiRequest(`/modules/releases/hygiene/refresh?version=${encodeURIComponent(selectedVersion.value)}`, {
      method: 'POST',
    })
    pollRefreshStatus()
  } catch (e) {
    refreshStatus.value = e.message || 'Refresh failed.'
    refreshing.value = false
  }
}

async function pollRefreshStatus() {
  if (refreshPollId) clearInterval(refreshPollId)
  refreshPollId = setInterval(async () => {
    try {
      const data = await apiRequest('/modules/releases/hygiene/refresh/status')
      if (data.running) {
        refreshStatus.value = (data.progress && data.progress.message) || 'Refreshing...'
      } else {
        refreshStatus.value = (data.lastResult && data.lastResult.message) || 'Refresh complete.'
        refreshing.value = false
        clearInterval(refreshPollId)
        refreshPollId = null
      }
    } catch {
      refreshStatus.value = 'Could not check refresh status.'
      refreshing.value = false
      clearInterval(refreshPollId)
      refreshPollId = null
    }
  }, 2000)
}

onMounted(() => {
  fetchConfig()
  fetchVersions()
})

onUnmounted(() => {
  if (refreshPollId) clearInterval(refreshPollId)
})
</script>
