<template>
  <div class="space-y-6">
    <!-- Sync Status Panel (above tabs) -->
    <SyncStatusPanel @toast="$emit('toast', $event)" />

    <!-- Team Data Source (above tabs — controls which tabs are visible) -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Team Data Source</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Choose how team structure and assignments are managed. Google Sheets is the legacy mode; In-App Management stores everything locally.
      </p>
      <div class="flex items-center gap-6">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            :checked="editTeamDataSource === 'sheets'"
            @change="setDataSource('sheets')"
            name="teamDataSource"
            class="text-primary-600 focus:ring-primary-500"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">Google Sheets (legacy)</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            :checked="editTeamDataSource === 'in-app'"
            @change="setDataSource('in-app')"
            name="teamDataSource"
            class="text-primary-600 focus:ring-primary-500"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">In-App Management</span>
        </label>
      </div>
      <p v-if="dataSourceSaveMessage" class="mt-2 text-sm" :class="dataSourceSaveError ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
        {{ dataSourceSaveMessage }}
      </p>
      <div v-if="editTeamDataSource === 'in-app'" class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-md">
        <p class="text-sm text-blue-800 dark:text-blue-300 mb-3">
          In-App mode stores team structure locally. If migrating from Sheets, use the button below to copy existing team/assignment data.
        </p>
        <button
          v-if="!alreadyMigrated"
          @click="showMigrateConfirm = true"
          :disabled="migrating"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg v-if="migrating" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          {{ migrating ? 'Migrating...' : 'Migrate from Sheets' }}
        </button>
        <p v-if="alreadyMigrated" class="text-sm text-green-600 dark:text-green-400">
          Migration already completed on {{ new Date(config._migratedToInApp).toLocaleDateString() }}.
        </p>
        <p v-if="migrateResult" class="mt-2 text-sm" :class="migrateError ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
          {{ migrateResult }}
        </p>
      </div>
    </div>

    <!-- Migration Field Config Dialog -->
    <MigrationFieldConfig
      v-if="showMigrateConfirm"
      @confirm="handleMigrate"
      @cancel="showMigrateConfirm = false"
    />

    <!-- Sub-tabs for Team Tracker settings -->
    <div class="flex space-x-4 border-b border-gray-200 dark:border-gray-700">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id"
        class="pb-2 px-1 text-sm font-medium border-b-2 transition-colors"
        :class="activeTab === tab.id
          ? 'border-primary-600 text-primary-600'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
      >
        {{ tab.label }}
      </button>
    </div>

    <PeopleAndTeamsSettings v-if="activeTab === 'people-teams'" @config-saved="handleConfigSaved" @toast="$emit('toast', $event)" />
    <GoogleSheetsSettings v-if="activeTab === 'google-sheets'" @config-saved="handleConfigSaved" @toast="$emit('toast', $event)" />
    <JiraSyncSettings v-if="activeTab === 'jira-sync'" />
    <SnapshotSettings v-if="activeTab === 'snapshots'" />
    <TeamManagement v-if="activeTab === 'teams'" />
    <FieldDefinitionManager v-if="activeTab === 'fields'" />
    <AuditLogView v-if="activeTab === 'audit-log'" />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import SyncStatusPanel from './SyncStatusPanel.vue'
import PeopleAndTeamsSettings from './PeopleAndTeamsSettings.vue'
import GoogleSheetsSettings from './GoogleSheetsSettings.vue'
import JiraSyncSettings from './JiraSyncSettings.vue'
import SnapshotSettings from './SnapshotSettings.vue'
import TeamManagement from './TeamManagement.vue'
import FieldDefinitionManager from './FieldDefinitionManager.vue'
import AuditLogView from './AuditLogView.vue'
import MigrationFieldConfig from './MigrationFieldConfig.vue'
import { useSyncStatus } from '../composables/useSyncStatus'
import { useRosterSync } from '../composables/useRosterSync'
import { useRoster } from '@shared/client'

defineEmits(['toast'])

const { markConfigDirty } = useSyncStatus()
const { reloadRoster } = useRoster()
const { config, fetchConfig, saveConfig } = useRosterSync()

// --- Data source state ---
const editTeamDataSource = ref('sheets')
const dataSourceSaveMessage = ref(null)
const dataSourceSaveError = ref(false)

// Migration state
const showMigrateConfirm = ref(false)
const migrating = ref(false)
const migrateResult = ref(null)
const migrateError = ref(false)

const alreadyMigrated = computed(() => !!config.value?._migratedToInApp)

// Initialize from config
fetchConfig().then(() => {
  if (config.value) {
    editTeamDataSource.value = config.value.teamDataSource || 'sheets'
  }
})

// Also sync if config reloads
watch(config, (cfg) => {
  if (cfg) {
    editTeamDataSource.value = cfg.teamDataSource || 'sheets'
  }
})

async function setDataSource(value) {
  editTeamDataSource.value = value
  dataSourceSaveMessage.value = null
  dataSourceSaveError.value = false
  try {
    await saveConfig({ teamDataSource: value })
    await reloadRoster()
    dataSourceSaveMessage.value = `Data source set to ${value === 'in-app' ? 'In-App Management' : 'Google Sheets'}.`
    setTimeout(() => { dataSourceSaveMessage.value = null }, 3000)
  } catch (err) {
    dataSourceSaveError.value = true
    dataSourceSaveMessage.value = `Failed to save: ${err.message}`
    // Revert on failure
    editTeamDataSource.value = config.value?.teamDataSource || 'sheets'
  }
}

async function handleMigrate(fieldOverrides) {
  showMigrateConfirm.value = false
  migrating.value = true
  migrateResult.value = null
  migrateError.value = false
  try {
    const result = await apiRequest('/modules/team-tracker/structure/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fieldOverrides })
    })
    migrateResult.value = `Migration complete: ${result.teams} teams, ${result.assignments} assignments, ${result.fields} fields created.`
    await fetchConfig()
  } catch (err) {
    migrateError.value = true
    migrateResult.value = `Migration failed: ${err.message}`
  } finally {
    migrating.value = false
  }
}

// --- Tabs ---
const isInAppMode = computed(() => editTeamDataSource.value === 'in-app')
const baseTabs = [
  { id: 'people-teams', label: 'People & Teams' },
  { id: 'jira-sync', label: 'Jira Sync' },
  { id: 'snapshots', label: 'Snapshots' }
]

const sheetsTabs = [
  { id: 'google-sheets', label: 'Google Sheets' }
]

const inAppTabs = [
  { id: 'teams', label: 'Teams' },
  { id: 'fields', label: 'Fields' },
  { id: 'audit-log', label: 'Audit Log' }
]

const tabs = computed(() => {
  if (isInAppMode.value) return [...baseTabs, ...inAppTabs]
  return [...baseTabs, ...sheetsTabs]
})

const activeTab = ref('people-teams')

// Reset to first tab if active tab becomes invisible
watch(tabs, (newTabs) => {
  if (!newTabs.some(t => t.id === activeTab.value)) {
    activeTab.value = 'people-teams'
  }
})

function handleConfigSaved(payload) {
  if (payload?.structureAffecting) {
    markConfigDirty()
  }
}
</script>
