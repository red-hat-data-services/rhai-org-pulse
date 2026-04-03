<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">API Tokens</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Create and manage personal API tokens for programmatic access.</p>
      </div>
      <button
        @click="showCreateModal = true"
        class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
      >
        <Plus :size="16" />
        Create Token
      </button>
    </div>

    <!-- Help panel (collapsible) -->
    <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl overflow-hidden">
      <button
        @click="helpExpanded = !helpExpanded"
        class="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 transition-colors"
      >
        <span class="flex items-center gap-2">
          <Info :size="16" />
          How to use API tokens
        </span>
        <component :is="helpExpanded ? ChevronUp : ChevronDown" :size="16" />
      </button>
      <div v-if="helpExpanded" class="px-4 pb-4 text-sm text-blue-800 dark:text-blue-200 space-y-3 border-t border-blue-200 dark:border-blue-800 pt-3">
        <div>
          <p class="font-medium mb-1">Authorization header format:</p>
          <code class="block bg-blue-100 dark:bg-blue-900/40 px-3 py-2 rounded-lg text-xs font-mono">Authorization: Bearer tt_your_token_here</code>
        </div>
        <div>
          <p class="font-medium mb-1">Example curl command:</p>
          <code class="block bg-blue-100 dark:bg-blue-900/40 px-3 py-2 rounded-lg text-xs font-mono break-all">curl -H "Authorization: Bearer tt_..." {{ apiBaseUrl }}/api/roster</code>
        </div>
        <ul class="list-disc list-inside space-y-1 text-xs">
          <li>Tokens are shown <strong>once</strong> at creation — copy immediately.</li>
          <li>Tokens can have an optional expiration (30 days, 90 days, or 1 year).</li>
          <li>Revoke tokens at any time from this page.</li>
          <li>In production, use the dedicated API route hostname for token-authenticated requests.</li>
        </ul>
        <p class="text-xs">
          See <a href="/api/docs" target="_blank" rel="noopener" class="underline hover:text-blue-900 dark:hover:text-blue-100">API Docs</a> for the full endpoint reference.
        </p>
      </div>
    </div>

    <!-- Token just created banner -->
    <div v-if="newlyCreatedToken" class="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-xl p-4 space-y-2">
      <div class="flex items-start gap-2">
        <CheckCircle :size="20" class="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-green-800 dark:text-green-200">Token created successfully</p>
          <p class="text-xs text-green-700 dark:text-green-300 mt-1">Copy this token now. It won't be shown again.</p>
          <div class="mt-2 flex items-center gap-2">
            <code class="flex-1 bg-white dark:bg-gray-800 border border-green-300 dark:border-green-600 px-3 py-2 rounded-lg text-sm font-mono text-gray-900 dark:text-gray-100 break-all select-all">{{ newlyCreatedToken }}</code>
            <button
              @click="copyToken"
              class="flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/60 transition-colors"
            >
              <Copy :size="14" />
              {{ copied ? 'Copied!' : copyFailed ? 'Copy failed' : 'Copy' }}
            </button>
          </div>
        </div>
        <button @click="newlyCreatedToken = null" class="text-green-400 hover:text-green-600 dark:hover:text-green-200">
          <X :size="16" />
        </button>
      </div>
    </div>

    <!-- My Tokens -->
    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">My Tokens</h2>
      </div>
      <div v-if="loading" class="p-8 text-center text-sm text-gray-500 dark:text-gray-400">Loading...</div>
      <div v-else-if="tokens.length === 0" class="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
        No tokens yet. Create one to get started.
      </div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            <th class="px-4 py-2">Name</th>
            <th class="px-4 py-2">Prefix</th>
            <th class="px-4 py-2 hidden sm:table-cell">Created</th>
            <th class="px-4 py-2">Expires</th>
            <th class="px-4 py-2 hidden md:table-cell">Last Used</th>
            <th class="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr v-for="token in tokens" :key="token.id" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{{ token.name }}</td>
            <td class="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{{ token.tokenPrefix }}...</td>
            <td class="px-4 py-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">{{ formatDate(token.createdAt) }}</td>
            <td class="px-4 py-3">
              <span v-if="!token.expiresAt" class="text-gray-400 dark:text-gray-500">Never</span>
              <span v-else-if="isExpired(token.expiresAt)" class="text-red-600 dark:text-red-400 font-medium">Expired</span>
              <span v-else class="text-gray-500 dark:text-gray-400">{{ formatDate(token.expiresAt) }}</span>
            </td>
            <td class="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">{{ token.lastUsedAt ? formatDate(token.lastUsedAt) : 'Never' }}</td>
            <td class="px-4 py-3 text-right">
              <button
                @click="handleRevoke(token.id)"
                class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-xs font-medium"
              >Revoke</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Admin: All Tokens -->
    <div v-if="isAdmin" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        @click="adminExpanded = !adminExpanded"
        class="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <span class="flex items-center gap-2">
          <Shield :size="16" class="text-gray-400" />
          All Tokens (Admin)
        </span>
        <component :is="adminExpanded ? ChevronUp : ChevronDown" :size="16" class="text-gray-400" />
      </button>
      <div v-if="adminExpanded" class="border-t border-gray-200 dark:border-gray-700">
        <div v-if="allTokens.length === 0" class="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
          No tokens exist.
        </div>
        <table v-else class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              <th class="px-4 py-2">Owner</th>
              <th class="px-4 py-2">Name</th>
              <th class="px-4 py-2 hidden sm:table-cell">Prefix</th>
              <th class="px-4 py-2 hidden md:table-cell">Created</th>
              <th class="px-4 py-2">Expires</th>
              <th class="px-4 py-2 hidden lg:table-cell">Last Used</th>
              <th class="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr v-for="token in allTokens" :key="token.id" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{{ token.ownerEmail }}</td>
              <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{{ token.name }}</td>
              <td class="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400 hidden sm:table-cell">{{ token.tokenPrefix }}...</td>
              <td class="px-4 py-3 text-gray-500 dark:text-gray-400 hidden md:table-cell">{{ formatDate(token.createdAt) }}</td>
              <td class="px-4 py-3">
                <span v-if="!token.expiresAt" class="text-gray-400 dark:text-gray-500">Never</span>
                <span v-else-if="isExpired(token.expiresAt)" class="text-red-600 dark:text-red-400 font-medium">Expired</span>
                <span v-else class="text-gray-500 dark:text-gray-400">{{ formatDate(token.expiresAt) }}</span>
              </td>
              <td class="px-4 py-3 text-gray-500 dark:text-gray-400 hidden lg:table-cell">{{ token.lastUsedAt ? formatDate(token.lastUsedAt) : 'Never' }}</td>
              <td class="px-4 py-3 text-right">
                <button
                  @click="handleAdminRevoke(token.id)"
                  class="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-xs font-medium"
                >Revoke</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create Token Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm" @click="showCreateModal = false" />
      <div class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Create API Token</h3>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Token Name</label>
          <input
            v-model="newTokenName"
            type="text"
            maxlength="100"
            placeholder="e.g., My CI script"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            @keydown.enter="handleCreate"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expiration</label>
          <select
            v-model="newTokenExpiry"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="90d">90 days</option>
            <option value="30d">30 days</option>
            <option value="1y">1 year</option>
            <option :value="null">No expiration</option>
          </select>
        </div>
        <div v-if="createError" class="text-sm text-red-600 dark:text-red-400">{{ createError }}</div>
        <div class="flex justify-end gap-3 pt-2">
          <button
            @click="showCreateModal = false"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >Cancel</button>
          <button
            @click="handleCreate"
            :disabled="!newTokenName.trim() || creating"
            class="px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >{{ creating ? 'Creating...' : 'Create Token' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Plus, Info, ChevronUp, ChevronDown, Copy, X, CheckCircle, Shield } from 'lucide-vue-next'
import { useApiTokens } from '../composables/useApiTokens'

const props = defineProps({
  isAdmin: Boolean
})

const emit = defineEmits(['toast'])

const {
  tokens,
  allTokens,
  loading,
  loadTokens,
  loadAllTokens,
  createToken,
  revokeToken,
  adminRevokeToken
} = useApiTokens()

const helpExpanded = ref(false)
const adminExpanded = ref(false)
const showCreateModal = ref(false)
const newTokenName = ref('')
const newTokenExpiry = ref('90d')
const newlyCreatedToken = ref(null)
const copied = ref(false)
const copyFailed = ref(false)
const creating = ref(false)
const createError = ref(null)

const apiBaseUrl = window.location.origin

onMounted(async () => {
  await loadTokens()
  if (props.isAdmin) {
    await loadAllTokens()
  }
})

async function handleCreate() {
  if (!newTokenName.value.trim() || creating.value) return
  creating.value = true
  createError.value = null
  try {
    const result = await createToken(newTokenName.value.trim(), newTokenExpiry.value)
    newlyCreatedToken.value = result.token
    showCreateModal.value = false
    newTokenName.value = ''
    newTokenExpiry.value = '90d'
    if (props.isAdmin) await loadAllTokens()
  } catch (err) {
    createError.value = err.message
  } finally {
    creating.value = false
  }
}

async function handleRevoke(id) {
  try {
    await revokeToken(id)
    if (props.isAdmin) await loadAllTokens()
    emit('toast', { message: 'Token revoked', type: 'success' })
  } catch (err) {
    emit('toast', { message: 'Failed to revoke token: ' + err.message, type: 'error' })
  }
}

async function handleAdminRevoke(id) {
  try {
    await adminRevokeToken(id)
    emit('toast', { message: 'Token revoked', type: 'success' })
  } catch (err) {
    emit('toast', { message: 'Failed to revoke token: ' + err.message, type: 'error' })
  }
}

function copyToken() {
  if (!newlyCreatedToken.value) return
  navigator.clipboard.writeText(newlyCreatedToken.value).then(() => {
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }).catch(() => {
    copyFailed.value = true
    setTimeout(() => { copyFailed.value = false }, 2000)
  })
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function isExpired(expiresAt) {
  if (!expiresAt) return false
  return new Date(expiresAt) <= new Date()
}
</script>
