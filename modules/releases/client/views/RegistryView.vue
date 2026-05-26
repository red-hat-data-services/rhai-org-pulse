<template>
  <div>
    <!-- Permission guard -->
    <div v-if="!hasAccess" class="text-center py-16">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h2>
      <p class="text-gray-500 dark:text-gray-400">You don't have permission to view this page. The release-manager role is required.</p>
    </div>

    <template v-else>
    <!-- Tab bar -->
    <div class="border-b border-gray-200 dark:border-gray-700">
      <nav class="flex -mb-px px-4" aria-label="Manage sub-tabs">
        <button
          v-for="tab in manageTabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="px-4 py-3 text-sm font-medium border-b-2 transition-colors"
          :class="activeTab === tab.id
            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- Hygiene Rules tab -->
    <div v-if="activeTab === 'hygiene'" class="p-6">
      <HygieneConfigView />
    </div>

    <!-- Releases tab -->
    <div v-else class="max-w-4xl mx-auto py-6 px-4">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Release Registry</h1>
      <div class="flex items-center gap-3">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search releases..."
          class="w-64 pl-4 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <button
          @click="handleDiscover"
          :disabled="discovering"
          class="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {{ discovering ? 'Discovering...' : 'Discover' }}
        </button>
      </div>
    </div>

    <!-- Discover result message -->
    <div
      v-if="discoverMessage"
      class="mb-4 p-3 rounded-lg text-sm"
      :class="discoverError
        ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
        : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'"
    >
      {{ discoverMessage }}
    </div>

    <!-- Product filter -->
    <div v-if="products.length > 1" class="flex flex-wrap gap-2 mb-4">
      <button
        @click="selectedProduct = null"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
        :class="!selectedProduct
          ? 'bg-primary-600 text-white border-primary-600'
          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-gray-600'"
      >
        All
      </button>
      <button
        v-for="product in products"
        :key="product"
        @click="selectedProduct = product"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
        :class="selectedProduct === product
          ? 'bg-primary-600 text-white border-primary-600'
          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-gray-600'"
      >
        {{ product }}
      </button>
    </div>

    <!-- Show archived toggle -->
    <div class="flex items-center gap-2 mb-4">
      <input
        id="show-archived"
        type="checkbox"
        v-model="showArchived"
        class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
      />
      <label for="show-archived" class="text-sm text-gray-600 dark:text-gray-400">Show archived</label>
    </div>

    <!-- Create form -->
    <div
      v-if="showCreateForm"
      class="mb-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 shadow-sm"
    >
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">New Release</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ID *</label>
          <input
            v-model="createForm.id"
            type="text"
            placeholder="e.g. rhoai-2.16"
            class="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500"
          />
          <p v-if="createIdError" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ createIdError }}</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name *</label>
          <input
            v-model="createForm.displayName"
            type="text"
            placeholder="e.g. RHOAI 2.16"
            class="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div class="sm:col-span-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fix Versions</label>
          <input
            v-model="createForm.fixVersions"
            type="text"
            placeholder="Comma-separated, e.g. RHOAI-2.16, rhoai-2.16"
            class="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product Pages Shortname</label>
          <input
            v-model="createForm.productPagesShortname"
            type="text"
            class="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product Pages Version</label>
          <input
            v-model="createForm.productPagesVersion"
            type="text"
            class="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Code Freeze</label>
          <input v-model="createForm.codeFreeze" type="date" class="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">EA1</label>
          <input v-model="createForm.ea1" type="date" class="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GA</label>
          <input v-model="createForm.ga" type="date" class="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500" />
        </div>
      </div>
      <div class="flex items-center gap-3 mt-4">
        <button
          @click="handleCreate"
          :disabled="creating"
          class="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {{ creating ? 'Creating...' : 'Create' }}
        </button>
        <button
          @click="showCreateForm = false"
          class="px-4 py-2 text-gray-600 dark:text-gray-400 text-sm font-medium hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="text-center py-12 text-gray-500 dark:text-gray-400">Loading releases...</div>

    <!-- Empty state -->
    <div
      v-else-if="releases.length === 0"
      class="text-center py-16 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
    >
      <div class="text-gray-400 dark:text-gray-500 mb-4">
        <svg class="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      </div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No releases yet</h3>
      <p class="text-gray-500 dark:text-gray-400 mb-6">Get started by discovering releases from Product Pages or creating one manually.</p>
      <div class="flex items-center justify-center gap-3">
        <button
          @click="handleDiscover"
          :disabled="discovering"
          class="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {{ discovering ? 'Discovering...' : 'Discover from Product Pages' }}
        </button>
        <button
          @click="showCreateForm = true"
          class="px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Create manually
        </button>
      </div>
    </div>

    <!-- No matches for current filter -->
    <div
      v-else-if="filteredReleases.length === 0"
      class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center"
    >
      <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">No matching releases</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400">Try a different product filter or enable "Show archived".</p>
    </div>

    <!-- Release cards -->
    <div v-else class="space-y-4">
      <div
        v-for="release in filteredReleases"
        :key="release.id"
        :ref="el => { if (el) cardRefs[release.id] = el }"
        class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 shadow-sm"
      >
        <!-- Edit mode -->
        <template v-if="editingId === release.id">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Edit: {{ release.id }}
            <span v-if="release.source === 'product-pages'" class="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
              (Product Pages fields are read-only)
            </span>
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="sm:col-span-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
              <input
                v-model="editForm.displayName"
                type="text"
                :disabled="release.source === 'product-pages'"
                :class="release.source === 'product-pages' ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : 'bg-white dark:bg-gray-700'"
                class="w-full px-3 py-2 border rounded-lg text-sm border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div class="sm:col-span-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fix Versions</label>
              <input
                v-model="editForm.fixVersions"
                type="text"
                placeholder="Comma-separated"
                class="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product Pages Shortname</label>
              <input
                v-model="editForm.productPagesShortname"
                type="text"
                :disabled="release.source === 'product-pages'"
                :class="release.source === 'product-pages' ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : 'bg-white dark:bg-gray-700'"
                class="w-full px-3 py-2 border rounded-lg text-sm border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product Pages Version</label>
              <input
                v-model="editForm.productPagesVersion"
                type="text"
                :disabled="release.source === 'product-pages'"
                :class="release.source === 'product-pages' ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : 'bg-white dark:bg-gray-700'"
                class="w-full px-3 py-2 border rounded-lg text-sm border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Code Freeze</label>
              <input
                v-model="editForm.codeFreeze"
                type="date"
                :disabled="release.source === 'product-pages'"
                :class="release.source === 'product-pages' ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : 'bg-white dark:bg-gray-700'"
                class="w-full px-3 py-2 border rounded-lg text-sm border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">EA1</label>
              <input
                v-model="editForm.ea1"
                type="date"
                :disabled="release.source === 'product-pages'"
                :class="release.source === 'product-pages' ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : 'bg-white dark:bg-gray-700'"
                class="w-full px-3 py-2 border rounded-lg text-sm border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GA</label>
              <input
                v-model="editForm.ga"
                type="date"
                :disabled="release.source === 'product-pages'"
                :class="release.source === 'product-pages' ? 'bg-gray-100 dark:bg-gray-600 cursor-not-allowed' : 'bg-white dark:bg-gray-700'"
                class="w-full px-3 py-2 border rounded-lg text-sm border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
          <!-- Read-only extra milestones -->
          <div v-if="extraMilestones(release).length > 0" class="mt-3">
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Other milestones (read-only)</p>
            <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <template v-for="[key, value] in extraMilestones(release)" :key="key">
                <dt class="text-gray-500 dark:text-gray-400">{{ formatMilestoneLabel(key) }}</dt>
                <dd class="text-gray-900 dark:text-gray-100">{{ value }}</dd>
              </template>
            </dl>
          </div>
          <div class="flex items-center gap-3 mt-4">
            <button
              @click="handleSave(release.id)"
              :disabled="saving"
              class="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {{ saving ? 'Saving...' : 'Save' }}
            </button>
            <button
              @click="cancelEdit"
              class="px-4 py-2 text-gray-600 dark:text-gray-400 text-sm font-medium hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </template>

        <!-- Display mode -->
        <template v-else>
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-2">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ release.displayName || release.id }}</h2>
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  :class="release.state === 'active'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'"
                >
                  {{ release.state }}
                </span>
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                  :class="release.source === 'product-pages'
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'"
                >
                  {{ release.source === 'product-pages' ? 'Product Pages' : 'Manual' }}
                </span>
              </div>
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">{{ release.id }}</p>

              <!-- Fix versions -->
              <div v-if="release.fixVersions?.length" class="flex flex-wrap gap-1.5 mb-3">
                <span
                  v-for="fv in release.fixVersions"
                  :key="fv"
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                >
                  {{ fv }}
                </span>
              </div>

              <!-- Product Pages info -->
              <p v-if="release.productPagesShortname" class="text-sm text-gray-500 dark:text-gray-400 mb-3">
                Product Pages: {{ release.productPagesShortname }}{{ release.productPagesVersion ? ' / ' + release.productPagesVersion : '' }}
              </p>

              <!-- Milestones -->
              <div v-if="release.milestones && Object.keys(release.milestones).length > 0" class="mb-3">
                <div class="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <div v-for="[key, value] in sortedMilestones(release.milestones)" :key="key" class="flex items-center gap-1.5">
                    <span class="text-gray-500 dark:text-gray-400">{{ formatMilestoneLabel(key) }}:</span>
                    <span class="text-gray-900 dark:text-gray-100">{{ value }}</span>
                  </div>
                </div>
              </div>

              <!-- Timestamps -->
              <p class="text-xs text-gray-400 dark:text-gray-500">
                Created: {{ formatDate(release.createdAt) }}
                <span v-if="release.updatedAt"> &middot; Updated: {{ formatDate(release.updatedAt) }}</span>
              </p>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2 ml-4">
              <button
                @click="startEdit(release)"
                class="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {{ release.source === 'product-pages' ? 'Edit Local Fields' : 'Edit' }}
              </button>
              <button
                v-if="release.state === 'active'"
                @click="handleArchive(release.id)"
                class="px-3 py-1.5 text-sm font-medium text-red-100 bg-red-600 dark:bg-red-700 rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
              >
                Archive
              </button>
              <button
                v-else
                @click="handleRestore(release.id)"
                class="px-3 py-1.5 text-sm font-medium text-green-100 bg-green-600 dark:bg-green-700 rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
              >
                Restore
              </button>
            </div>
          </div>
        </template>
      </div>

      <!-- New Release button -->
      <div v-if="!showCreateForm" class="flex justify-end">
        <button
          @click="showCreateForm = true"
          class="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          + New Release
        </button>
      </div>
    </div>
    </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUpdate, nextTick, watch, inject } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'
import { useAuth } from '@shared/client/composables/useAuth.js'
import HygieneConfigView from '../components/HygieneConfigView.vue'

const nav = inject('moduleNav')

const manageTabs = [
  { id: 'releases', label: 'Releases' },
  { id: 'hygiene', label: 'Hygiene Rules' },
]

const VALID_MANAGE_TABS = manageTabs.map(t => t.id)
const DEFAULT_MANAGE_TAB = 'releases'

const activeTab = ref(DEFAULT_MANAGE_TAB)

let updatingFromUrl = false

watch(activeTab, (tab) => {
  if (!updatingFromUrl) {
    nav.updateParams({ tab: tab === DEFAULT_MANAGE_TAB ? undefined : tab })
  }
})

watch(() => nav.params.value?.tab, (tabParam) => {
  const tab = tabParam && VALID_MANAGE_TABS.includes(tabParam) ? tabParam : DEFAULT_MANAGE_TAB
  if (activeTab.value !== tab) {
    updatingFromUrl = true
    activeTab.value = tab
    nextTick(() => { updatingFromUrl = false })
  }
}, { immediate: true })

const { isAdmin, roles: userRoles } = useAuth()
const hasAccess = computed(() => isAdmin.value || userRoles.value.includes('release-manager'))

const releases = ref([])
const loading = ref(true)
const showArchived = ref(false)
const selectedProduct = ref(null)
const searchQuery = ref('')
const showCreateForm = ref(false)
const discovering = ref(false)
const discoverMessage = ref('')
const discoverError = ref(false)
const creating = ref(false)
const saving = ref(false)
const editingId = ref(null)
const createIdError = ref('')
const cardRefs = ref({})

onBeforeUpdate(() => { cardRefs.value = {} })

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/

const createForm = ref({
  id: '',
  displayName: '',
  fixVersions: '',
  productPagesShortname: '',
  productPagesVersion: '',
  codeFreeze: '',
  ea1: '',
  ga: ''
})

const editForm = ref({
  displayName: '',
  fixVersions: '',
  productPagesShortname: '',
  productPagesVersion: '',
  codeFreeze: '',
  ea1: '',
  ga: ''
})

const KNOWN_MILESTONES = ['codeFreeze', 'ea1', 'ga']

function getProduct(release) {
  if (release.productPagesShortname) return release.productPagesShortname
  const match = release.id.match(/^([a-z]+)-/)
  return match ? match[1] : release.id
}

const products = computed(() => {
  const set = new Set(releases.value.map(getProduct))
  return [...set].sort()
})

const filteredReleases = computed(() => {
  let result = releases.value
  if (!showArchived.value) result = result.filter(r => r.state !== 'archived')
  if (selectedProduct.value) result = result.filter(r => getProduct(r) === selectedProduct.value)
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    result = result.filter(r =>
      r.id.toLowerCase().includes(q) ||
      (r.displayName || '').toLowerCase().includes(q) ||
      (r.fixVersions || []).some(fv => fv.toLowerCase().includes(q))
    )
  }
  return result
})

async function fetchReleases() {
  try {
    const data = await apiRequest('/modules/releases/registry')
    releases.value = data.releases || []
  } catch (e) {
    console.error('Failed to fetch releases:', e)
  } finally {
    loading.value = false
  }
}

async function handleDiscover() {
  discovering.value = true
  discoverMessage.value = ''
  discoverError.value = false
  try {
    const result = await apiRequest('/modules/releases/registry/discover', { method: 'POST' })
    const discovered = result.discovered || 0
    const created = result.created || 0
    const updated = result.updated || 0
    const archived = result.archived || 0
    const parts = []
    if (created) parts.push(`${created} created`)
    if (updated) parts.push(`${updated} updated`)
    if (archived) parts.push(`${archived} archived`)
    discoverMessage.value = `Discovered ${discovered} release(s)${parts.length ? ': ' + parts.join(', ') : ' — no changes needed'}.`
    await fetchReleases()
  } catch (e) {
    discoverError.value = true
    discoverMessage.value = e.message || 'Discovery failed.'
  } finally {
    discovering.value = false
  }
}

function parseFixVersions(str) {
  return str.split(',').map(s => s.trim()).filter(Boolean)
}

function buildMilestones(form) {
  const milestones = {}
  if (form.codeFreeze) milestones.codeFreeze = form.codeFreeze
  if (form.ea1) milestones.ea1 = form.ea1
  if (form.ga) milestones.ga = form.ga
  return milestones
}

async function handleCreate() {
  createIdError.value = ''
  if (!createForm.value.id || !createForm.value.displayName) return
  if (!ID_PATTERN.test(createForm.value.id)) {
    createIdError.value = 'ID must start with a letter or digit and contain only lowercase letters, digits, dots, hyphens, or underscores.'
    return
  }
  creating.value = true
  try {
    const body = {
      id: createForm.value.id,
      displayName: createForm.value.displayName,
      fixVersions: parseFixVersions(createForm.value.fixVersions),
      milestones: buildMilestones(createForm.value)
    }
    if (createForm.value.productPagesShortname) body.productPagesShortname = createForm.value.productPagesShortname
    if (createForm.value.productPagesVersion) body.productPagesVersion = createForm.value.productPagesVersion
    await apiRequest('/modules/releases/registry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    showCreateForm.value = false
    createForm.value = { id: '', displayName: '', fixVersions: '', productPagesShortname: '', productPagesVersion: '', codeFreeze: '', ea1: '', ga: '' }
    await fetchReleases()
  } catch (e) {
    if (e.status === 400) {
      createIdError.value = e.message || 'Invalid input.'
    } else {
      console.error('Failed to create release:', e)
    }
  } finally {
    creating.value = false
  }
}

function startEdit(release) {
  editingId.value = release.id
  editForm.value = {
    displayName: release.displayName || '',
    fixVersions: (release.fixVersions || []).join(', '),
    productPagesShortname: release.productPagesShortname || '',
    productPagesVersion: release.productPagesVersion || '',
    codeFreeze: release.milestones?.codeFreeze || '',
    ea1: release.milestones?.ea1 || '',
    ga: release.milestones?.ga || ''
  }
  nextTick(() => {
    const el = cardRefs.value[release.id]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}

function cancelEdit() {
  editingId.value = null
}

async function handleSave(id) {
  saving.value = true
  try {
    const release = releases.value.find(r => r.id === id)
    const isPP = release?.source === 'product-pages'

    // For PP releases, only send local-only fields (fixVersions)
    // For manual releases, send everything
    const body = { fixVersions: parseFixVersions(editForm.value.fixVersions) }

    if (!isPP) {
      body.displayName = editForm.value.displayName
      body.productPagesShortname = editForm.value.productPagesShortname || undefined
      body.productPagesVersion = editForm.value.productPagesVersion || undefined
      // Merge existing extra milestones with edited known ones
      const milestones = { ...(release?.milestones || {}) }
      for (const key of KNOWN_MILESTONES) {
        if (editForm.value[key]) {
          milestones[key] = editForm.value[key]
        } else {
          delete milestones[key]
        }
      }
      body.milestones = milestones
    }
    await apiRequest(`/modules/releases/registry/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    editingId.value = null
    await fetchReleases()
  } catch (e) {
    console.error('Failed to save release:', e)
  } finally {
    saving.value = false
  }
}

async function handleArchive(id) {
  if (!confirm(`Archive release "${id}"? It can be restored later.`)) return
  try {
    await apiRequest(`/modules/releases/registry/${encodeURIComponent(id)}`, { method: 'DELETE' })
    await fetchReleases()
  } catch (e) {
    console.error('Failed to archive release:', e)
  }
}

async function handleRestore(id) {
  try {
    await apiRequest(`/modules/releases/registry/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: 'active' })
    })
    await fetchReleases()
  } catch (e) {
    console.error('Failed to restore release:', e)
  }
}

function formatMilestoneLabel(key) {
  const labels = { codeFreeze: 'Code Freeze', ea1: 'EA1', ga: 'GA' }
  return labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
}

function sortedMilestones(milestones) {
  return Object.entries(milestones).sort(([a], [b]) => {
    const order = [...KNOWN_MILESTONES]
    const ai = order.indexOf(a)
    const bi = order.indexOf(b)
    if (ai >= 0 && bi >= 0) return ai - bi
    if (ai >= 0) return -1
    if (bi >= 0) return 1
    return a.localeCompare(b)
  })
}

function extraMilestones(release) {
  if (!release.milestones) return []
  return Object.entries(release.milestones).filter(([key]) => !KNOWN_MILESTONES.includes(key))
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString()
}

onMounted(() => {
  if (hasAccess.value) fetchReleases()
})
</script>
