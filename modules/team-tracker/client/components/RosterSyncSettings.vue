<template>
  <div class="space-y-6">
    <!-- Sync Status -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Roster Sync</h3>
        <div class="flex items-center gap-3">
          <span
            v-if="config?.lastSyncStatus"
            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
            :class="config.lastSyncStatus === 'success'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'"
          >
            {{ config.lastSyncStatus === 'success' ? 'Healthy' : 'Error' }}
          </span>
          <span v-else class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            Never synced
          </span>
          <button
            @click="handleSync"
            :disabled="syncing || !isConfigured"
            class="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            <svg class="h-4 w-4" :class="{ 'animate-spin': syncing }" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {{ syncing ? 'Syncing...' : 'Sync Now' }}
          </button>
        </div>
      </div>
      <div v-if="config?.lastSyncAt" class="text-sm text-gray-500 dark:text-gray-400">
        Last synced: {{ formatDate(config.lastSyncAt) }}
      </div>
      <div v-if="config?.lastSyncError" class="mt-2 text-sm text-red-600 dark:text-red-400">
        Error: {{ config.lastSyncError }}
      </div>
    </div>

    <!-- Org Roots -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Org Roots</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Define the org leaders whose teams will be tracked. The roster sync traverses each leader's LDAP reporting chain.
      </p>

      <div class="space-y-3 mb-4">
        <div
          v-for="(root, idx) in editRoots"
          :key="idx"
          class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md"
        >
          <div class="flex-1 grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Kerberos UID</label>
              <input
                v-model="root.uid"
                placeholder="e.g. shgriffi"
                class="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Display Name</label>
              <input
                v-model="root.displayName"
                placeholder="e.g. AI Platform"
                class="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
          <button
            @click="removeRoot(idx)"
            class="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors mt-4"
            title="Remove"
          >
            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <button
        @click="addRoot"
        class="text-sm text-primary-600 hover:text-primary-700 dark:hover:text-primary-400 font-medium flex items-center gap-1"
      >
        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Add org root
      </button>
    </div>

    <!-- Username Inference -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Username Inference</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Optionally infer missing GitHub/GitLab usernames by matching roster people against org/group member lists.
      </p>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GitHub Orgs</label>
          <div class="space-y-2 mb-2">
            <div v-for="(org, idx) in editGithubOrgs" :key="'gh-' + idx" class="flex items-center gap-2">
              <input
                v-model="editGithubOrgs[idx]"
                placeholder="e.g. opendatahub-io"
                class="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              <button
                @click="editGithubOrgs.splice(idx, 1)"
                class="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Remove"
              >
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <button
            @click="editGithubOrgs.push('')"
            class="text-sm text-primary-600 hover:text-primary-700 dark:hover:text-primary-400 font-medium flex items-center gap-1"
          >
            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Add GitHub org
          </button>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Requires GITHUB_TOKEN env var.</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GitLab Groups</label>
          <div class="space-y-2 mb-2">
            <div v-for="(group, idx) in editGitlabGroups" :key="'gl-' + idx" class="flex items-center gap-2">
              <input
                v-model="editGitlabGroups[idx]"
                placeholder="e.g. redhat/rhoai"
                class="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              <button
                @click="editGitlabGroups.splice(idx, 1)"
                class="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Remove"
              >
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <button
            @click="editGitlabGroups.push('')"
            class="text-sm text-primary-600 hover:text-primary-700 dark:hover:text-primary-400 font-medium flex items-center gap-1"
          >
            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Add GitLab group
          </button>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Requires GITLAB_TOKEN env var.</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Exclude GitLab Groups</label>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Skip these groups when fetching contributions (e.g., mirror repositories).
          </p>
          <div class="space-y-2 mb-2">
            <div v-for="(group, idx) in editGitlabExcludeGroups" :key="'gl-exclude-' + idx" class="flex items-center gap-2">
              <input
                v-model="editGitlabExcludeGroups[idx]"
                placeholder="e.g. redhat/rhel-ai/core/mirrors"
                class="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              <button
                @click="editGitlabExcludeGroups.splice(idx, 1)"
                class="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Remove"
              >
                <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <button
            @click="editGitlabExcludeGroups.push('')"
            class="text-sm text-primary-600 hover:text-primary-700 dark:hover:text-primary-400 font-medium flex items-center gap-1"
          >
            <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Add excluded group
          </button>
        </div>
      </div>
    </div>

    <!-- Save -->
    <div class="flex items-center gap-3">
      <button
        @click="handleSave"
        :disabled="saving || !canSave"
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
import { ref, computed, onMounted, watch } from 'vue'
import { useRosterSync } from '../composables/useRosterSync'

const emit = defineEmits(['toast'])

const {
  config,
  saving,
  syncing,
  isConfigured,
  fetchConfig,
  saveConfig,
  triggerSync
} = useRosterSync()

const editRoots = ref([])
const editGithubOrgs = ref([])
const editGitlabGroups = ref([])
const editGitlabExcludeGroups = ref([])
const saveMessage = ref(null)
const saveError = ref(false)

const canSave = computed(() => {
  return editRoots.value.some(r => r.uid && r.displayName)
})

function populateForm() {
  if (config.value && config.value.configured) {
    editRoots.value = (config.value.orgRoots || []).map(r => ({ ...r }))
    editGithubOrgs.value = [...(config.value.githubOrgs || [])]
    editGitlabGroups.value = [...(config.value.gitlabGroups || [])]
    // Default to known mirror group if no exclude list exists
    editGitlabExcludeGroups.value = [...(config.value.gitlabExcludeGroups || ['redhat/rhel-ai/core/mirrors'])]
  } else {
    editRoots.value = [{ uid: '', displayName: '' }]
    editGithubOrgs.value = []
    editGitlabGroups.value = []
    editGitlabExcludeGroups.value = ['redhat/rhel-ai/core/mirrors']
  }
}

watch(config, populateForm)

onMounted(async () => {
  await fetchConfig()
  populateForm()
})

function addRoot() {
  editRoots.value.push({ uid: '', displayName: '' })
}

function removeRoot(idx) {
  editRoots.value.splice(idx, 1)
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString()
}

async function handleSave() {
  saveMessage.value = null
  saveError.value = false

  const orgRoots = editRoots.value
    .filter(r => r.uid && r.displayName)
    .map(r => ({ uid: r.uid.trim(), displayName: r.displayName.trim() }))

  if (orgRoots.length === 0) {
    saveMessage.value = 'At least one org root with UID and display name is required.'
    saveError.value = true
    return
  }

  try {
    const githubOrgs = editGithubOrgs.value.map(s => s.trim()).filter(Boolean)
    const gitlabGroups = editGitlabGroups.value.map(s => s.trim()).filter(Boolean)
    const gitlabExcludeGroups = editGitlabExcludeGroups.value.map(s => s.trim()).filter(Boolean)

    await saveConfig({
      orgRoots,
      githubOrgs,
      gitlabGroups,
      gitlabExcludeGroups
    })
    saveMessage.value = 'Configuration saved.'
    emit('toast', { message: 'Roster sync configuration saved', type: 'success' })
    setTimeout(() => { saveMessage.value = null }, 3000)
  } catch (err) {
    saveMessage.value = err.message
    saveError.value = true
  }
}

async function handleSync() {
  try {
    await triggerSync()
    emit('toast', { message: 'Roster sync started', type: 'success' })
  } catch (err) {
    emit('toast', { message: `Sync failed: ${err.message}`, type: 'error' })
  }
}
</script>
