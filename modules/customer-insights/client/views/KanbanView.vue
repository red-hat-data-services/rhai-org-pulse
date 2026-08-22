<template>
  <div class="p-6">
    <!-- Header -->
    <div class="mb-6">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-bold text-gray-900">Customer Interactions</h1>
          <InfoTooltip text="Customer interactions organized by RHOAI pillar and component. Each card shows how many customers have feedback for that component. Click to expand and see the customer list." />
        </div>
      </div>

      <!-- Search Bar -->
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search by customer company name..."
          class="pl-10 pr-10 py-2 w-full max-w-md border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="loadError" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <p class="text-red-800">Failed to load interactions: {{ loadError }}</p>
      <button @click="loadInteractions" class="mt-2 text-sm text-red-600 underline">Retry</button>
    </div>

    <!-- Pillar Board -->
    <div v-else class="grid grid-cols-4 gap-4">
      <div v-for="pillar in pillarsWithCounts" :key="pillar.name" class="bg-gray-50 rounded-lg p-4 min-h-[300px]">
        <!-- Pillar Header -->
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-semibold text-gray-700 uppercase">{{ pillar.name }}</h2>
          <span class="bg-gray-200 text-gray-600 text-xs font-medium px-2 py-1 rounded-full">
            {{ pillar.totalCount }}
          </span>
        </div>

        <!-- Component Cards -->
        <div class="space-y-3">
          <div
            v-for="comp in pillar.components"
            :key="comp.id"
            class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
            :class="{ 'ring-2 ring-primary-300': expandedComponent === comp.id }"
          >
            <!-- Component Header (always visible) -->
            <div
              @click="toggleComponent(comp.id)"
              class="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div class="flex items-center justify-between">
                <span class="font-medium text-sm text-gray-900">{{ comp.label }}</span>
                <span
                  v-if="comp.count > 0"
                  class="bg-primary-100 text-primary-800 text-xs font-semibold px-2 py-0.5 rounded-full"
                >
                  {{ comp.count }}
                </span>
                <span v-else class="text-xs text-gray-400">0</span>
              </div>
              <!-- Preview: top 3 customer names (collapsed) -->
              <p v-if="comp.count > 0 && expandedComponent !== comp.id" class="text-xs text-gray-500 mt-1 truncate">
                {{ comp.interactions.slice(0, 3).map(i => i.customerCompany).join(', ') }}<span v-if="comp.count > 3"> +{{ comp.count - 3 }} more</span>
              </p>
            </div>

            <!-- Expanded Customer List -->
            <div v-if="expandedComponent === comp.id && comp.count > 0" class="border-t border-gray-100">
              <div
                v-for="interaction in comp.interactions"
                :key="interaction.id"
                @click.stop="selectedInteraction = interaction"
                class="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-b-0"
              >
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium text-gray-800">{{ interaction.customerCompany }}</span>
                  <span :class="statusBadgeClass(interaction.status)">
                    {{ interaction.status }}
                  </span>
                </div>
                <div class="text-xs text-gray-500 mt-0.5">
                  {{ interaction.geo }} · {{ interaction.industryVertical }}
                </div>
              </div>
            </div>

            <!-- Expanded but empty -->
            <div v-if="expandedComponent === comp.id && comp.count === 0" class="border-t border-gray-100 px-3 py-3 text-xs text-gray-400 text-center">
              No customer interactions
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Detail Modal -->
    <div
      v-if="selectedInteraction"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      @click.self="closeModal"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div class="flex justify-between items-start mb-4">
          <h2 class="text-xl font-bold">{{ editedInteraction.customerCompany }}</h2>
          <div class="flex gap-2">
            <button
              v-if="!isEditing"
              @click="isEditing = true"
              class="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
            >
              Edit
            </button>
            <button
              v-if="isEditing"
              @click="saveChanges"
              :disabled="isSaving"
              class="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {{ isSaving ? 'Saving...' : 'Save' }}
            </button>
            <button
              v-if="isEditing"
              @click="cancelEditing"
              class="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              v-if="!isEditing"
              @click="deleteInteraction"
              :disabled="isDeleting"
              class="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {{ isDeleting ? 'Deleting...' : 'Delete' }}
            </button>
            <button @click="closeModal" class="text-gray-400 hover:text-gray-600 text-2xl">
              ×
            </button>
          </div>
        </div>

        <div class="space-y-4">
          <!-- Owner Section -->
          <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <label class="block text-sm font-medium text-gray-700 mb-1">Owner (PM working on this)</label>
            <input
              v-if="isEditing"
              v-model="editedInteraction.owner"
              type="text"
              placeholder="Enter your name..."
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p v-else class="text-sm text-gray-900">
              {{ editedInteraction.owner || 'Not assigned' }}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Contact</label>
              <input
                v-if="isEditing"
                v-model="editedInteraction.contactName"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p v-else class="text-sm text-gray-900">{{ editedInteraction.contactName }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Field Contact</label>
              <input
                v-if="isEditing"
                v-model="editedInteraction.fieldContactName"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <p v-else class="text-sm text-gray-900">{{ editedInteraction.fieldContactName }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Component</label>
              <span :class="componentBadgeClass(editedInteraction.component)">
                {{ editedInteraction.component }}
              </span>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Status</label>
              <span :class="statusBadgeClass(editedInteraction.status)">
                {{ editedInteraction.status }}
              </span>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Geography</label>
              <p class="text-sm text-gray-900">{{ editedInteraction.geo }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Industry</label>
              <p class="text-sm text-gray-900">{{ editedInteraction.industryVertical }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Environment</label>
              <p class="text-sm text-gray-900">{{ editedInteraction.environment }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Customer Type</label>
              <p class="text-sm text-gray-900">{{ editedInteraction.customerType }}</p>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Main Use Case</label>
            <p class="text-sm text-gray-900">{{ editedInteraction.mainAIUseCase }}</p>
          </div>

          <div v-if="editedInteraction.toolsOfChoice?.length">
            <label class="block text-sm font-medium text-gray-700">Tools of Choice</label>
            <div class="flex flex-wrap gap-2 mt-1">
              <span
                v-for="tool in editedInteraction.toolsOfChoice"
                :key="tool"
                class="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
              >
                {{ tool }}
              </span>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Pain Points</label>
            <p class="text-sm text-gray-900">{{ editedInteraction.painPoints }}</p>
          </div>

          <div v-if="editedInteraction.featureFeedback">
            <label class="block text-sm font-medium text-gray-700">Feature Feedback</label>
            <p class="text-sm text-gray-900">{{ editedInteraction.featureFeedback }}</p>
          </div>

          <div v-if="editedInteraction.futureWishlist?.length">
            <label class="block text-sm font-medium text-gray-700">Future Wishlist</label>
            <ul class="list-disc list-inside text-sm text-gray-900 space-y-1">
              <li v-for="item in editedInteraction.futureWishlist" :key="item">{{ item }}</li>
            </ul>
          </div>

          <!-- Transcript Section -->
          <div class="border-t pt-4 mt-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              <svg class="inline-block w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Transcript
            </label>
            <div class="bg-gray-50 border border-gray-300 rounded-lg p-4 min-h-[80px]">
              <p v-if="editedInteraction.meetingNotes" class="text-sm text-gray-900 whitespace-pre-wrap">{{ editedInteraction.meetingNotes }}</p>
              <p v-else class="text-sm text-gray-400 italic">No transcript available</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import InfoTooltip from '../components/InfoTooltip.vue'
import { useComponentSelector } from '../composables/useComponentSelector'

const { pillars } = useComponentSelector()

const selectedInteraction = ref(null)
const editedInteraction = ref({})
const isEditing = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const searchQuery = ref('')
const interactions = ref([])
const isLoading = ref(true)
const loadError = ref(null)
const expandedComponent = ref(null)

async function loadInteractions() {
  isLoading.value = true
  loadError.value = null

  try {
    const response = await fetch('/api/modules/customer-insights/interactions')

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    interactions.value = await response.json()
  } catch (err) {
    loadError.value = err.message
    console.error('Error loading interactions:', err)
  } finally {
    isLoading.value = false
  }
}

onMounted(loadInteractions)

const filteredInteractions = computed(() => {
  if (!searchQuery.value) {
    return interactions.value
  }
  const query = searchQuery.value.toLowerCase()
  return interactions.value.filter(i =>
    i.customerCompany?.toLowerCase().includes(query)
  )
})

const interactionsByComponent = computed(() => {
  const grouped = {}
  for (const interaction of filteredInteractions.value) {
    const key = interaction.component || 'Unknown'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(interaction)
  }
  return grouped
})

const pillarsWithCounts = computed(() => {
  return pillars.map(pillar => {
    const components = pillar.components.map(comp => {
      const matches = interactionsByComponent.value[comp.id] || []
      return {
        ...comp,
        interactions: matches,
        count: matches.length,
      }
    })
    return {
      name: pillar.name,
      components,
      totalCount: components.reduce((sum, c) => sum + c.count, 0),
    }
  })
})

function toggleComponent(componentId) {
  expandedComponent.value = expandedComponent.value === componentId ? null : componentId
}

function componentBadgeClass(component) {
  const classes = {
    'vLLM': 'text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded',
    'llm-d': 'text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded',
    'Model Serving': 'text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded',
    'Model Runtimes': 'text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded',
    'LlamaStack': 'text-xs bg-pink-100 text-pink-800 px-2 py-1 rounded',
    'RAG + Vector DB': 'text-xs bg-green-100 text-green-800 px-2 py-1 rounded',
    'AutoRAG': 'text-xs bg-green-100 text-green-800 px-2 py-1 rounded',
    'Data Processing': 'text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded',
    'Feature Store': 'text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded',
    'SDG (Synthetic Data Generation)': 'text-xs bg-violet-100 text-violet-800 px-2 py-1 rounded',
    'Training': 'text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded',
    'Training Hub': 'text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded',
    'Fine Tuning': 'text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded',
    'Agentic': 'text-xs bg-pink-100 text-pink-800 px-2 py-1 rounded',
    'Agent Development': 'text-xs bg-pink-100 text-pink-800 px-2 py-1 rounded',
    'AgentOps': 'text-xs bg-fuchsia-100 text-fuchsia-800 px-2 py-1 rounded',
    'Project Navigator': 'text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded',
    'Notebooks': 'text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded',
    'AI Hub': 'text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded',
    'AI Pipelines': 'text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded',
    'MLflow': 'text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded',
    'Model Observability': 'text-xs bg-cyan-100 text-cyan-800 px-2 py-1 rounded',
    'Explainability': 'text-xs bg-teal-100 text-teal-800 px-2 py-1 rounded',
    'AI Safety': 'text-xs bg-red-100 text-red-800 px-2 py-1 rounded',
    'Model Evaluation': 'text-xs bg-cyan-100 text-cyan-800 px-2 py-1 rounded',
  }
  return classes[component] || 'text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded'
}

function statusBadgeClass(status) {
  const classes = {
    'Lead': 'text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded',
    'Discovery': 'text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded',
    'Evaluating': 'text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded',
    'Feedback Received': 'text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded',
    'Closed': 'text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded',
  }
  return classes[status] || classes['Lead']
}

watch(selectedInteraction, (newVal) => {
  if (newVal) {
    editedInteraction.value = { ...newVal }
    isEditing.value = false
  }
})

function closeModal() {
  selectedInteraction.value = null
  editedInteraction.value = {}
  isEditing.value = false
}

function cancelEditing() {
  editedInteraction.value = { ...selectedInteraction.value }
  isEditing.value = false
}

async function saveChanges() {
  isSaving.value = true
  try {
    const response = await fetch(`/api/modules/customer-insights/interactions/${editedInteraction.value.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editedInteraction.value)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    const updated = await response.json()

    const index = interactions.value.findIndex(i => i.id === updated.id)
    if (index !== -1) {
      interactions.value[index] = updated
    }

    selectedInteraction.value = updated
    editedInteraction.value = { ...updated }
    isEditing.value = false
  } catch (err) {
    alert(`Error saving changes: ${err.message}`)
    console.error('Error saving interaction:', err)
  } finally {
    isSaving.value = false
  }
}

async function deleteInteraction() {
  if (!confirm(`Are you sure you want to delete this interaction for ${editedInteraction.value.customerCompany}?`)) {
    return
  }

  isDeleting.value = true
  try {
    const response = await fetch(`/api/modules/customer-insights/interactions/${editedInteraction.value.id}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    interactions.value = interactions.value.filter(i => i.id !== editedInteraction.value.id)
    closeModal()
  } catch (err) {
    alert(`Error deleting interaction: ${err.message}`)
    console.error('Error deleting interaction:', err)
  } finally {
    isDeleting.value = false
  }
}
</script>
