<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h3 class="text-lg font-semibold text-gray-900">Registered Modules</h3>
      <div class="flex gap-2">
        <button
          @click="handleSyncAll"
          :disabled="syncingAll"
          class="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {{ syncingAll ? 'Syncing...' : 'Sync All' }}
        </button>
        <button
          @click="showAddForm = true"
          class="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700"
        >
          Add Module
        </button>
      </div>
    </div>

    <!-- Module list -->
    <div class="space-y-3 mb-8">
      <div
        v-for="mod in modules"
        :key="mod.slug"
        class="bg-white border border-gray-200 rounded-lg p-4"
      >
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2">
              <h4 class="font-medium text-gray-900">{{ mod.name }}</h4>
              <span class="px-2 py-0.5 text-[10px] font-medium rounded-full"
                :class="mod.type === 'built-in' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'">
                {{ mod.type }}
              </span>
            </div>
            <p class="text-sm text-gray-500 mt-1">{{ mod.description }}</p>
            <div v-if="mod.type === 'git-static'" class="mt-2 text-xs text-gray-400 space-y-0.5">
              <p v-if="mod.gitUrl">Repo: {{ mod.gitUrl }}</p>
              <p v-if="mod.gitBranch">Branch: {{ mod.gitBranch }}</p>
              <p v-if="mod.lastSyncAt">Last synced: {{ formatDate(mod.lastSyncAt) }}</p>
              <p v-if="mod.lastSyncStatus" :class="mod.lastSyncStatus === 'error' ? 'text-red-500' : 'text-green-500'">
                Status: {{ mod.lastSyncStatus }}
                <span v-if="mod.lastSyncError"> — {{ mod.lastSyncError }}</span>
              </p>
              <p v-if="mod.gitToken">Token: {{ mod.gitToken }}</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button
              v-if="mod.type === 'git-static'"
              @click="handleSync(mod.slug)"
              :disabled="syncingModules.has(mod.slug)"
              class="px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              {{ syncingModules.has(mod.slug) ? 'Syncing...' : 'Sync' }}
            </button>
            <button
              @click="startEdit(mod)"
              class="px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-50"
            >
              Edit
            </button>
            <button
              @click="handleDelete(mod.slug, mod.name)"
              class="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <p v-if="modules.length === 0" class="text-sm text-gray-400 text-center py-8">
        No modules registered.
      </p>
    </div>

    <!-- Add/Edit Form Modal -->
    <div
      v-if="showAddForm || editingModule"
      class="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      @click.self="closeForm"
    >
      <div class="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          {{ editingModule ? 'Edit Module' : 'Add Module' }}
        </h3>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input v-model="form.name" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="My Dashboard" />
          </div>

          <div v-if="!editingModule">
            <label class="block text-sm font-medium text-gray-700 mb-1">Slug</label>
            <input v-model="form.slug" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="my-dashboard" />
            <p class="text-xs text-gray-400 mt-1">Lowercase letters, numbers, and hyphens only</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select v-model="form.type" :disabled="!!editingModule" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
              <option value="git-static">Git Static</option>
              <option value="built-in">Built-in</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input v-model="form.description" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="What this module does" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Icon</label>
            <select v-model="form.icon" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
              <option value="bar-chart">Bar Chart</option>
              <option value="search">Search</option>
              <option value="activity">Activity</option>
              <option value="globe">Globe</option>
              <option value="file-text">File Text</option>
              <option value="zap">Zap</option>
              <option value="layout">Layout</option>
              <option value="box">Box</option>
            </select>
          </div>

          <!-- Git-static fields -->
          <template v-if="form.type === 'git-static'">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Git URL</label>
              <input v-model="form.gitUrl" type="url" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="https://github.com/user/repo" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Branch</label>
              <input v-model="form.gitBranch" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="main" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Subdirectory</label>
              <input v-model="form.gitSubdirectory" type="text" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="/" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Token (optional, for private repos)</label>
              <input v-model="form.gitToken" type="password" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Leave blank for public repos" />
              <p v-if="editingModule && form.gitToken === '••••••••'" class="text-xs text-gray-400 mt-1">
                Token is set. Clear the field and type a new one to change it, or leave as-is to keep current token.
              </p>
            </div>
          </template>
        </div>

        <div v-if="formError" class="mt-3 text-sm text-red-600">{{ formError }}</div>

        <div class="flex justify-end gap-3 mt-6">
          <button @click="closeForm" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Cancel
          </button>
          <button
            @click="handleSubmit"
            :disabled="submitting"
            class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {{ submitting ? 'Saving...' : (editingModule ? 'Save' : 'Add') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useModuleAdmin } from '../composables/useModuleAdmin'
import { useModules } from '../composables/useModules'

const emit = defineEmits(['toast'])

const { getAdminModules, addModule, updateModule, removeModule, triggerSync, triggerSyncAll } = useModuleAdmin()
const { reloadModules } = useModules()

const modules = ref([])
const showAddForm = ref(false)
const editingModule = ref(null)
const submitting = ref(false)
const formError = ref('')
const syncingModules = reactive(new Set())
const syncingAll = ref(false)

const form = reactive({
  name: '',
  slug: '',
  type: 'git-static',
  description: '',
  icon: 'box',
  gitUrl: '',
  gitBranch: 'main',
  gitSubdirectory: '/',
  gitToken: ''
})

function resetForm() {
  form.name = ''
  form.slug = ''
  form.type = 'git-static'
  form.description = ''
  form.icon = 'box'
  form.gitUrl = ''
  form.gitBranch = 'main'
  form.gitSubdirectory = '/'
  form.gitToken = ''
  formError.value = ''
}

function closeForm() {
  showAddForm.value = false
  editingModule.value = null
  resetForm()
}

function startEdit(mod) {
  editingModule.value = mod.slug
  form.name = mod.name
  form.slug = mod.slug
  form.type = mod.type
  form.description = mod.description || ''
  form.icon = mod.icon || 'box'
  form.gitUrl = mod.gitUrl || ''
  form.gitBranch = mod.gitBranch || 'main'
  form.gitSubdirectory = mod.gitSubdirectory || '/'
  form.gitToken = mod.gitToken || ''
  formError.value = ''
}

async function loadModuleList() {
  try {
    const data = await getAdminModules()
    modules.value = data.modules || []
  } catch (err) {
    console.error('Failed to load modules:', err)
  }
}

async function handleSubmit() {
  submitting.value = true
  formError.value = ''
  try {
    if (editingModule.value) {
      const updates = {
        name: form.name,
        description: form.description,
        icon: form.icon
      }
      if (form.type === 'git-static') {
        updates.gitUrl = form.gitUrl
        updates.gitBranch = form.gitBranch
        updates.gitSubdirectory = form.gitSubdirectory
        // Only send token if changed from the masked value
        if (form.gitToken && form.gitToken !== '••••••••') {
          updates.gitToken = form.gitToken
        } else if (form.gitToken === '') {
          updates.gitToken = null
        }
      }
      await updateModule(editingModule.value, updates)
      emit('toast', { message: 'Module updated', type: 'success' })
    } else {
      const payload = {
        name: form.name,
        slug: form.slug,
        type: form.type,
        description: form.description,
        icon: form.icon
      }
      if (form.type === 'git-static') {
        payload.gitUrl = form.gitUrl
        payload.gitBranch = form.gitBranch || 'main'
        payload.gitSubdirectory = form.gitSubdirectory || '/'
        if (form.gitToken) payload.gitToken = form.gitToken
      }
      await addModule(payload)
      emit('toast', { message: 'Module added', type: 'success' })
    }
    closeForm()
    await loadModuleList()
    await reloadModules()
  } catch (err) {
    formError.value = err.message || 'Failed to save module'
  } finally {
    submitting.value = false
  }
}

async function handleDelete(slug, name) {
  if (!confirm(`Delete module "${name}"? This will remove the module and any synced content.`)) return
  try {
    await removeModule(slug)
    emit('toast', { message: `Module "${name}" deleted`, type: 'success' })
    await loadModuleList()
    await reloadModules()
  } catch (err) {
    emit('toast', { message: err.message || 'Failed to delete module', type: 'error' })
  }
}

async function handleSync(slug) {
  syncingModules.add(slug)
  try {
    await triggerSync(slug)
    emit('toast', { message: 'Sync started', type: 'success' })
    // Poll for completion
    setTimeout(async () => {
      await loadModuleList()
      syncingModules.delete(slug)
    }, 3000)
  } catch (err) {
    emit('toast', { message: err.message || 'Sync failed', type: 'error' })
    syncingModules.delete(slug)
  }
}

async function handleSyncAll() {
  syncingAll.value = true
  try {
    await triggerSyncAll()
    emit('toast', { message: 'Sync started for all modules', type: 'success' })
    setTimeout(async () => {
      await loadModuleList()
      syncingAll.value = false
    }, 5000)
  } catch (err) {
    emit('toast', { message: err.message || 'Sync failed', type: 'error' })
    syncingAll.value = false
  }
}

function formatDate(iso) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString()
}

onMounted(loadModuleList)
</script>
