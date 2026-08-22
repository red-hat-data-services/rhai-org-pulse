<template>
  <div class="max-w-7xl mx-auto px-4 py-6">
    <Toast v-if="toastMessage" :message="toastMessage" :type="toastType" @close="toastMessage = ''" />
    <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Jira Taxonomy</h2>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">Browse and manage Jira classification systems</p>

    <!-- Tabs -->
    <div class="flex space-x-4 border-b border-gray-200 dark:border-gray-700 mb-6">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="switchTab(tab.id)"
        class="pb-2 px-1 text-sm font-medium border-b-2 transition-colors"
        :class="activeTab === tab.id
          ? 'border-primary-600 text-primary-600'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Components Tab -->
    <div v-if="activeTab === 'components'">
      <!-- Info card -->
      <div
        v-if="project && !loading"
        class="mb-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400"
      >
        <svg class="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="flex-1">
          This list is sourced from the
          <a :href="`https://redhat.atlassian.net/projects/${project}/components`" target="_blank" rel="noopener noreferrer" class="font-medium text-primary-600 dark:text-primary-400 hover:underline">{{ project }}</a>
          Jira project's component registry.
          <template v-if="fetchedAt">Last synced {{ formatDate(fetchedAt) }}.</template>
          Components are synced automatically from Jira.
        </span>
        <button
          v-if="isAdmin"
          :disabled="syncing || syncCooldown"
          @click="triggerSync"
          class="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors"
          :class="syncCooldown
            ? 'border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'"
          :aria-label="syncing ? 'Syncing components from Jira' : syncCooldown ? `Sync available in ${cooldownRemaining}` : 'Refresh components from Jira'"
        >
          <svg v-if="syncing" class="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <svg v-else class="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {{ syncing ? 'Syncing...' : syncCooldown ? cooldownRemaining : 'Refresh' }}
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>

      <!-- Error -->
      <div v-else-if="error && !components.length" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
        <p class="text-red-700 dark:text-red-400 text-sm">{{ error }}</p>
      </div>

      <template v-else>
        <!-- Component Browser -->
        <div class="mb-8">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Components</h3>
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ filteredComponents.length }} component{{ filteredComponents.length !== 1 ? 's' : '' }}</span>
            </div>
            <div class="relative">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search by name, description, or lead..."
                class="pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 w-80"
              />
              <svg class="absolute left-3 top-2.5 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead class="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th
                    @click="toggleSort('name')"
                    class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 select-none"
                  >
                    Name {{ sortColumn === 'name' ? (sortAsc ? '\u25B2' : '\u25BC') : '' }}
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Description
                  </th>
                  <th
                    @click="toggleSort('lead')"
                    class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 select-none"
                  >
                    Lead {{ sortColumn === 'lead' ? (sortAsc ? '\u25B2' : '\u25BC') : '' }}
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Assignee Type
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                <tr
                  v-for="comp in filteredComponents"
                  :key="comp.name"
                  class="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                    {{ comp.name }}
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-md truncate" :title="comp.description">
                    {{ comp.description || '\u2014' }}
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                    {{ comp.lead ? comp.lead.displayName : '\u2014' }}
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {{ formatAssigneeType(comp.assigneeType) }}
                  </td>
                </tr>
                <tr v-if="filteredComponents.length === 0">
                  <td colspan="4" class="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    {{ searchQuery ? 'No components match your search.' : 'No components found.' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </div>

    <!-- Request Component Tab -->
    <div v-if="activeTab === 'request'" class="space-y-6">
      <!-- Naming Standards -->
      <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <h4 class="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">Naming Standards</h4>
        <ul class="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-disc list-inside">
          <li>Use Title Case</li>
          <li>Be singular unless accepted product name is plural</li>
          <li>Match official product terminology</li>
          <li>Avoid abbreviations unless universally recognized</li>
          <li>Avoid punctuation unless required</li>
          <li>Avoid creating duplicate concepts</li>
        </ul>
      </div>

      <!-- Submitting as -->
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Submitting as: <span class="font-medium text-gray-700 dark:text-gray-300">{{ userEmail }}</span>
      </p>

      <!-- Pre-request checklist -->
      <div>
        <div class="flex items-center gap-2 mb-3">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Pre-Request Checklist</h4>
          <span
            class="text-xs px-1.5 py-0.5 rounded-full font-medium"
            :class="preRequestCheckedCount === preRequestItems.length
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'"
          >{{ preRequestCheckedCount }}/{{ preRequestItems.length }}</span>
        </div>
        <div class="space-y-2">
          <label v-for="(item, idx) in preRequestItems" :key="idx" class="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              v-model="form.preRequestConfirmation[idx]"
              class="mt-0.5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
            <span>{{ item }}</span>
          </label>
        </div>
      </div>

      <!-- Form Fields -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Proposed Component Name/Rename <span class="text-red-500">*</span></label>
        <input
          v-model="form.proposedName"
          type="text"
          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="e.g., Model Registry"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Component Description &amp; Customer Capability <span class="text-red-500">*</span></label>
        <textarea
          v-model="form.description"
          rows="3"
          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="Describe the component and the customer capability it delivers"
        ></textarea>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Justification for New Component/Renamed Component <span class="text-red-500">*</span></label>
        <textarea
          v-model="form.justification"
          rows="3"
          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          placeholder="Why is a new component needed?"
        ></textarea>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Owning Product Manager <span class="text-red-500">*</span></label>
          <input
            v-model="form.owningPm"
            type="text"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Name of the owning PM"
          />
        </div>
        <div>
          <div class="flex items-center gap-1 mb-1">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">PM Leadership Approval - Director <span class="text-red-500">*</span></label>
            <div
              class="relative"
              @mouseenter="showPmApprovalHelp = true"
              @mouseleave="showPmApprovalHelp = false"
            >
              <svg class="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-label="Help: PM Leadership Approval">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div
                v-if="showPmApprovalHelp"
                class="absolute z-10 left-6 -top-2 w-72 p-3 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg"
              >
                <p>The PM Director who has reviewed and approved this component request. This ensures new components align with the product strategy and avoids duplication across teams.</p>
              </div>
            </div>
          </div>
          <input
            v-model="form.pmDirectorApproval"
            type="text"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Name of approving PM Director"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Primary Engineering Team and Manager <span class="text-red-500">*</span></label>
          <input
            v-model="form.engineeringTeamAndManager"
            type="text"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="e.g., Platform Team - Bob Jones"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Component Lead <span class="text-red-500">*</span></label>
          <input
            v-model="form.componentLead"
            type="text"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Name of the component lead"
          />
        </div>
      </div>

      <!-- Leadership Alignment -->
      <div>
        <div class="flex items-center gap-2 mb-3">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Leadership Alignment</h4>
          <span
            class="text-xs px-1.5 py-0.5 rounded-full font-medium"
            :class="leadershipCheckedCount === leadershipItems.length
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'"
          >{{ leadershipCheckedCount }}/{{ leadershipItems.length }}</span>
        </div>
        <div class="space-y-2">
          <label v-for="(item, idx) in leadershipItems" :key="idx" class="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              v-model="form.leadershipAlignment[idx]"
              class="mt-0.5 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
            <span>{{ item }}</span>
          </label>
        </div>
      </div>

      <!-- Submit -->
      <div>
        <div class="flex items-center gap-4">
          <button
            @click="submitRequest"
            :disabled="!formValid || submitting"
            class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ submitting ? 'Submitting...' : 'Submit Request' }}
          </button>
          <span v-if="submitMessage" :class="submitMessageClass" class="text-sm">{{ submitMessage }}</span>
        </div>
        <p v-if="!formValid && !submitting" class="mt-2 text-xs text-amber-600 dark:text-amber-400">
          {{ formIncompleteHint }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, inject } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import { useAuth } from '@shared/client/composables/useAuth'
import Toast from '@shared/client/components/Toast.vue'

const { user, isAdmin } = useAuth()
const moduleNav = inject('moduleNav')

const tabs = [
  { id: 'components', label: 'Browse Components' },
  { id: 'request', label: 'Request Component' }
]

// Support deep-linking via ?tab=<tabId>
const tabIds = tabs.map(t => t.id)
const initialTab = moduleNav?.params?.value?.tab
const activeTab = ref(tabIds.includes(initialTab) ? initialTab : 'components')

// Component browser state
const loading = ref(false)
const error = ref(null)
const components = ref([])
const project = ref('')
const fetchedAt = ref(null)
const searchQuery = ref('')
const sortColumn = ref('name')
const sortAsc = ref(true)

// Toast state
const toastMessage = ref('')
const toastType = ref('success')

// Sync state
const syncing = ref(false)
const syncCooldown = ref(false)
const cooldownRemaining = ref('')
let cooldownTimer = null

const DEFAULT_TAB = 'components'

function switchTab(tabId) {
  activeTab.value = tabId
  if (moduleNav && moduleNav.updateParams) {
    moduleNav.updateParams({ tab: tabId === DEFAULT_TAB ? undefined : tabId })
  }
}

const SYNC_OPTION_SET = 'component'
const COOLDOWN_MS = 5 * 60 * 1000

// Form state
const preRequestItems = [
  'I have searched the existing inventory; no duplicate or similar naming variations exist.',
  'This work cannot reasonably fit under an existing component.',
  'This represents a long-lived capability, not a short-term project effort.',
  'I understand that duplicate, confusing, or vague components will be rejected.'
]

const leadershipItems = [
  'The Owning PM has approved this request.',
  'The Engineering Manager of the impacted team has approved'
]

function createEmptyForm() {
  return {
    preRequestConfirmation: [false, false, false, false],
    proposedName: '',
    description: '',
    justification: '',
    owningPm: '',
    pmDirectorApproval: '',
    engineeringTeamAndManager: '',
    componentLead: '',
    leadershipAlignment: [false, false]
  }
}

const showPmApprovalHelp = ref(false)
const form = ref(createEmptyForm())
const submitting = ref(false)
const submitMessage = ref('')
const submitMessageType = ref('success')

const userEmail = computed(() => user.value?.email || 'unknown')

const formValid = computed(() => {
  const f = form.value
  return f.preRequestConfirmation.every(Boolean)
    && f.proposedName.trim()
    && f.description.trim()
    && f.justification.trim()
    && f.owningPm.trim()
    && f.pmDirectorApproval.trim()
    && f.engineeringTeamAndManager.trim()
    && f.componentLead.trim()
    && f.leadershipAlignment.every(Boolean)
})

const preRequestCheckedCount = computed(() => form.value.preRequestConfirmation.filter(Boolean).length)
const leadershipCheckedCount = computed(() => form.value.leadershipAlignment.filter(Boolean).length)

const formIncompleteHint = computed(() => {
  const missing = []
  if (preRequestCheckedCount.value < preRequestItems.length) {
    missing.push(`pre-request checklist (${preRequestCheckedCount.value}/${preRequestItems.length})`)
  }
  if (leadershipCheckedCount.value < leadershipItems.length) {
    missing.push(`leadership alignment (${leadershipCheckedCount.value}/${leadershipItems.length})`)
  }
  const f = form.value
  const emptyFields = []
  if (!f.proposedName.trim()) emptyFields.push('proposed name')
  if (!f.description.trim()) emptyFields.push('description')
  if (!f.justification.trim()) emptyFields.push('justification')
  if (!f.owningPm.trim()) emptyFields.push('owning PM')
  if (!f.pmDirectorApproval.trim()) emptyFields.push('PM director approval')
  if (!f.engineeringTeamAndManager.trim()) emptyFields.push('engineering team')
  if (!f.componentLead.trim()) emptyFields.push('component lead')
  if (emptyFields.length) missing.push(emptyFields.length === 1 ? `${emptyFields[0]} is required` : `${emptyFields.length} required fields`)
  return missing.length ? 'Still needed: ' + missing.join(', ') + '.' : ''
})

const submitMessageClass = computed(() => {
  return submitMessageType.value === 'error'
    ? 'text-red-600 dark:text-red-400'
    : 'text-green-600 dark:text-green-400'
})

const filteredComponents = computed(() => {
  let result = components.value
  const q = searchQuery.value.toLowerCase().trim()
  if (q) {
    result = result.filter(c =>
      c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q) || (c.lead?.displayName || '').toLowerCase().includes(q)
    )
  }

  const col = sortColumn.value
  const asc = sortAsc.value
  return [...result].sort((a, b) => {
    let aVal, bVal
    if (col === 'lead') {
      aVal = a.lead ? a.lead.displayName.toLowerCase() : ''
      bVal = b.lead ? b.lead.displayName.toLowerCase() : ''
    } else {
      aVal = (a[col] || '').toLowerCase()
      bVal = (b[col] || '').toLowerCase()
    }
    if (aVal < bVal) return asc ? -1 : 1
    if (aVal > bVal) return asc ? 1 : -1
    return 0
  })
})

function toggleSort(col) {
  if (sortColumn.value === col) {
    sortAsc.value = !sortAsc.value
  } else {
    sortColumn.value = col
    sortAsc.value = true
  }
}

function formatAssigneeType(type) {
  if (!type) return '\u2014'
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

async function fetchComponents() {
  loading.value = true
  error.value = null
  try {
    const data = await apiRequest('/modules/team-tracker/jira-components')
    components.value = data.components || []
    project.value = data.project || ''
    fetchedAt.value = data.fetchedAt || null
  } catch (err) {
    error.value = err.message || 'Failed to load components'
  } finally {
    loading.value = false
  }
}

function startCooldown(syncedAtIso) {
  const syncedAt = new Date(syncedAtIso).getTime()
  function tick() {
    const elapsed = Date.now() - syncedAt
    const remaining = COOLDOWN_MS - elapsed
    if (remaining <= 0) {
      syncCooldown.value = false
      cooldownRemaining.value = ''
      cooldownTimer = null
      return
    }
    syncCooldown.value = true
    const totalSecs = Math.ceil(remaining / 1000)
    const mins = Math.floor(totalSecs / 60)
    const secs = totalSecs % 60
    cooldownRemaining.value = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
    cooldownTimer = setTimeout(tick, 1000)
  }
  tick()
}

async function triggerSync() {
  syncing.value = true
  try {
    const result = await apiRequest(`/modules/team-tracker/field-options/${SYNC_OPTION_SET}/sync/trigger`, {
      method: 'POST'
    })
    await fetchComponents()
    startCooldown(new Date().toISOString())
    toastType.value = 'success'
    toastMessage.value = `Synced ${result.valuesCount} components from Jira.`
  } catch (err) {
    if (err.status === 429) {
      startCooldown(fetchedAt.value || new Date().toISOString())
    } else {
      toastType.value = 'error'
      toastMessage.value = 'Sync failed: ' + (err.message || 'Unknown error')
    }
  } finally {
    syncing.value = false
  }
}

async function submitRequest() {
  if (!formValid.value || submitting.value) return
  submitting.value = true
  submitMessage.value = ''

  const f = form.value
  const payload = {
    preRequestConfirmation: preRequestItems.filter((_, i) => f.preRequestConfirmation[i]),
    proposedName: f.proposedName.trim(),
    description: f.description.trim(),
    justification: f.justification.trim(),
    owningPm: f.owningPm.trim(),
    pmDirectorApproval: f.pmDirectorApproval.trim(),
    engineeringTeamAndManager: f.engineeringTeamAndManager.trim(),
    componentLead: f.componentLead.trim(),
    leadershipAlignment: leadershipItems.filter((_, i) => f.leadershipAlignment[i])
  }

  try {
    await apiRequest('/modules/team-tracker/jira-components/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    submitMessage.value = 'Component request submitted successfully!'
    submitMessageType.value = 'success'
    form.value = createEmptyForm()
  } catch (err) {
    if (err.status === 429) {
      const retryAfter = err.retryAfter || 60
      submitMessage.value = `Please wait ${retryAfter} seconds before submitting another request.`
    } else if (err.data?.details?.length) {
      submitMessage.value = err.data.details.join('; ')
    } else {
      submitMessage.value = err.message || 'Failed to submit request'
    }
    submitMessageType.value = 'error'
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchComponents().then(() => {
    if (fetchedAt.value) {
      const elapsed = Date.now() - new Date(fetchedAt.value).getTime()
      if (elapsed < COOLDOWN_MS) {
        startCooldown(fetchedAt.value)
      }
    }
  })
})

onUnmounted(() => {
  if (cooldownTimer) clearTimeout(cooldownTimer)
})
</script>
