<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

const API_BASE = '/modules/releases/draft-plans/config'

const config = ref(null)
const loading = ref(true)
const loadError = ref(null)
const saving = ref(false)
const saveError = ref(null)
const saveSuccess = ref(false)

const newPlanAdminEmail = ref('')
const newViewerEmail = ref('')

const planAdminOverridden = computed(function() {
  return !!(config.value && config.value.planAdminEmailsOverridden)
})

const viewerOverridden = computed(function() {
  return !!(config.value && config.value.draftPlansViewerEmailsOverridden)
})

async function loadConfig() {
  loading.value = true
  loadError.value = null
  try {
    config.value = await apiRequest(API_BASE)
  } catch (err) {
    config.value = null
    loadError.value = err.message || 'Failed to load Draft Plans access settings'
  } finally {
    loading.value = false
  }
}

function addEmail(listKey, inputRef) {
  if (!config.value) return
  var value = String(inputRef.value || '')
    .trim()
    .toLowerCase()
  if (!value || value.indexOf('@') === -1) return
  if (!Array.isArray(config.value[listKey])) {
    config.value[listKey] = []
  }
  if (config.value[listKey].indexOf(value) !== -1) {
    inputRef.value = ''
    return
  }
  config.value[listKey] = config.value[listKey].concat([value])
  inputRef.value = ''
}

function removeEmail(listKey, email) {
  if (!config.value || !Array.isArray(config.value[listKey])) return
  config.value[listKey] = config.value[listKey].filter(function(item) {
    return item !== email
  })
}

function resetPlanAdminsToDefaults() {
  if (!config.value) return
  config.value.planAdminEmails = (config.value.defaultPlanAdminEmails || []).slice()
}

function resetViewersToDefaults() {
  if (!config.value) return
  config.value.draftPlansViewerEmails = (config.value.defaultDraftPlansViewerEmails || []).slice()
}

function listsEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false
  }
  for (var i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return false
  }
  return true
}

async function saveAccess() {
  if (!config.value) return
  saving.value = true
  saveError.value = null
  saveSuccess.value = false
  try {
    var planAdminEmails = config.value.planAdminEmails || []
    var draftPlansViewerEmails = config.value.draftPlansViewerEmails || []
    var defaultAdmins = config.value.defaultPlanAdminEmails || []
    var defaultViewers = config.value.defaultDraftPlansViewerEmails || []
    await apiRequest(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planAdminEmails: listsEqual(planAdminEmails, defaultAdmins) ? [] : planAdminEmails,
        draftPlansViewerEmails: listsEqual(draftPlansViewerEmails, defaultViewers)
          ? []
          : draftPlansViewerEmails
      })
    })
    saveSuccess.value = true
    setTimeout(function() {
      saveSuccess.value = false
    }, 3000)
    await loadConfig()
  } catch (err) {
    saveError.value = err.message || 'Failed to save access settings'
  } finally {
    saving.value = false
  }
}

onMounted(function() {
  loadConfig()
})
</script>

<template>
  <div class="space-y-5">
    <p class="text-xs text-gray-500 dark:text-gray-400">
      Control who can open Draft Plans and who can freeze events, reset the plan, or edit any row.
      Stored on the server data volume; empty saved lists fall back to code defaults after deploy.
    </p>

    <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">Loading access settings…</div>
    <div v-else-if="loadError" class="text-sm text-red-600 dark:text-red-400">{{ loadError }}</div>

    <template v-else-if="config">
      <div class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Plan admins</h4>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Freeze / unfreeze, Final GA, reset, and edit all rows.
            </p>
          </div>
          <span
            class="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full"
            :class="planAdminOverridden
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'"
          >
            {{ planAdminOverridden ? 'Custom list saved' : 'Using code defaults' }}
          </span>
        </div>

        <ul v-if="config.planAdminEmails && config.planAdminEmails.length" class="space-y-1">
          <li
            v-for="email in config.planAdminEmails"
            :key="'admin-' + email"
            class="flex items-center justify-between gap-2 rounded-md border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-sm"
          >
            <span class="font-mono text-xs text-gray-800 dark:text-gray-200">{{ email }}</span>
            <button
              type="button"
              class="text-xs text-red-600 dark:text-red-400 hover:underline"
              @click="removeEmail('planAdminEmails', email)"
            >
              Remove
            </button>
          </li>
        </ul>
        <p v-else class="text-xs text-gray-400 dark:text-gray-500">No plan admins configured.</p>

        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="newPlanAdminEmail"
            type="email"
            placeholder="name@redhat.com"
            class="flex-1 min-w-[12rem] border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
            @keydown.enter.prevent="addEmail('planAdminEmails', newPlanAdminEmail)"
          />
          <button
            type="button"
            class="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            @click="addEmail('planAdminEmails', newPlanAdminEmail)"
          >
            Add plan admin
          </button>
          <button
            type="button"
            class="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            @click="resetPlanAdminsToDefaults"
          >
            Reset to code defaults
          </button>
        </div>
      </div>

      <div class="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Draft Plans viewers</h4>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Who can open the Draft Plans tab and use draft-plans APIs.
            </p>
          </div>
          <span
            class="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full"
            :class="viewerOverridden
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'"
          >
            {{ viewerOverridden ? 'Custom list saved' : 'Using code defaults' }}
          </span>
        </div>

        <ul v-if="config.draftPlansViewerEmails && config.draftPlansViewerEmails.length" class="space-y-1">
          <li
            v-for="email in config.draftPlansViewerEmails"
            :key="'viewer-' + email"
            class="flex items-center justify-between gap-2 rounded-md border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-sm"
          >
            <span class="font-mono text-xs text-gray-800 dark:text-gray-200">{{ email }}</span>
            <button
              type="button"
              class="text-xs text-red-600 dark:text-red-400 hover:underline"
              @click="removeEmail('draftPlansViewerEmails', email)"
            >
              Remove
            </button>
          </li>
        </ul>
        <p v-else class="text-xs text-gray-400 dark:text-gray-500">No viewers configured.</p>

        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="newViewerEmail"
            type="email"
            placeholder="name@redhat.com"
            class="flex-1 min-w-[12rem] border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
            @keydown.enter.prevent="addEmail('draftPlansViewerEmails', newViewerEmail)"
          />
          <button
            type="button"
            class="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            @click="addEmail('draftPlansViewerEmails', newViewerEmail)"
          >
            Add viewer
          </button>
          <button
            type="button"
            class="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            @click="resetViewersToDefaults"
          >
            Reset to code defaults
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          class="px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 disabled:opacity-50"
          :disabled="saving"
          @click="saveAccess"
        >
          {{ saving ? 'Saving…' : 'Save access settings' }}
        </button>
        <span v-if="saveSuccess" class="text-sm text-green-600 dark:text-green-400">Saved</span>
        <span v-if="saveError" class="text-sm text-red-600 dark:text-red-400">{{ saveError }}</span>
      </div>
    </template>
  </div>
</template>
