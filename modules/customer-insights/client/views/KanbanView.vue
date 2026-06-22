<template>
  <div class="p-6">
    <!-- Onboarding Modal -->
    <OnboardingModal
      :show="showOnboarding"
      @close="showOnboarding = false"
      @complete="handleOnboardingComplete"
    />

    <!-- Header -->
    <div class="mb-6">
      <div class="flex justify-between items-center mb-4">
        <div class="flex items-center gap-2">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Customer Interactions</h1>
            <p class="text-gray-600 mt-1">All customer interactions across engagement stages</p>
          </div>
          <InfoTooltip text="Visual pipeline view of customer interactions organized by engagement status (Lead → Discovery → Evaluating → Feedback Received → Closed). Drag and drop cards between columns to update status." />
        </div>

        <!-- Component Selector -->
        <select
          v-model="selectedComponent"
          class="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option v-for="component in components" :key="component.id" :value="component.id">
            {{ component.label }}
          </option>
        </select>
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
          class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
        />
        <div v-if="searchQuery" class="absolute inset-y-0 right-0 pr-3 flex items-center">
          <button
            @click="searchQuery = ''"
            class="text-gray-400 hover:text-gray-600"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center py-20">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
      <div class="text-gray-500">Loading interactions...</div>
    </div>

    <!-- Error State -->
    <div v-else-if="loadError" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
      <p class="text-red-800">Error loading interactions: {{ loadError }}</p>
      <button
        @click="loadInteractions"
        class="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        Retry
      </button>
    </div>

    <!-- Kanban Board - All Interactions -->
    <div v-else class="grid grid-cols-5 gap-4">
      <div
        v-for="status in statuses"
        :key="status"
        class="bg-gray-50 rounded-lg p-4 min-h-[600px]"
      >
        <div class="flex justify-between items-center mb-4">
          <h3 class="font-semibold text-gray-900">{{ status }}</h3>
          <span class="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
            {{ interactionsByStatus[status]?.length || 0 }}
          </span>
        </div>

        <div class="space-y-3">
          <div
            v-for="item in interactionsByStatus[status]"
            :key="item.id"
            class="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow"
            @click="selectedInteraction = item"
          >
            <div class="font-medium text-gray-900 mb-1">{{ item.customerCompany }}</div>
            <div class="text-sm text-gray-600 mb-2">{{ item.contactName }}</div>

            <!-- Component Badge -->
            <div class="mb-2">
              <span :class="componentBadgeClass(item.component)">
                {{ item.component }}
              </span>
            </div>

            <!-- Geo + Industry -->
            <div class="text-xs text-gray-500">
              {{ item.geo }} • {{ item.industryVertical }}
            </div>
          </div>

          <div v-if="!interactionsByStatus[status]?.length" class="text-sm text-gray-400 text-center py-4">
            Coming Soon
          </div>
        </div>
      </div>
    </div>

    <!-- Detail Modal -->
    <div
      v-if="selectedInteraction"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      @click.self="selectedInteraction = null"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div class="flex justify-between items-start mb-4">
          <h2 class="text-xl font-bold">{{ selectedInteraction.customerCompany }}</h2>
          <button @click="selectedInteraction = null" class="text-gray-400 hover:text-gray-600 text-2xl">
            ×
          </button>
        </div>

        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700">Contact</label>
              <p class="text-sm text-gray-900">{{ selectedInteraction.contactName }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Field Contact</label>
              <p class="text-sm text-gray-900">{{ selectedInteraction.fieldContactName }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Component</label>
              <span :class="componentBadgeClass(selectedInteraction.component)">
                {{ selectedInteraction.component }}
              </span>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Status</label>
              <span :class="statusBadgeClass(selectedInteraction.status)">
                {{ selectedInteraction.status }}
              </span>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Geography</label>
              <p class="text-sm text-gray-900">{{ selectedInteraction.geo }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Industry</label>
              <p class="text-sm text-gray-900">{{ selectedInteraction.industryVertical }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Environment</label>
              <p class="text-sm text-gray-900">{{ selectedInteraction.environment }}</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700">Customer Type</label>
              <p class="text-sm text-gray-900">{{ selectedInteraction.customerType }}</p>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Main Use Case</label>
            <p class="text-sm text-gray-900">{{ selectedInteraction.mainAIUseCase }}</p>
          </div>

          <div v-if="selectedInteraction.toolsOfChoice?.length">
            <label class="block text-sm font-medium text-gray-700">Tools of Choice</label>
            <div class="flex flex-wrap gap-2 mt-1">
              <span
                v-for="tool in selectedInteraction.toolsOfChoice"
                :key="tool"
                class="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
              >
                {{ tool }}
              </span>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Pain Points</label>
            <p class="text-sm text-gray-900">{{ selectedInteraction.painPoints }}</p>
          </div>

          <div v-if="selectedInteraction.featureFeedback">
            <label class="block text-sm font-medium text-gray-700">Feature Feedback</label>
            <p class="text-sm text-gray-900">{{ selectedInteraction.featureFeedback }}</p>
          </div>

          <div v-if="selectedInteraction.futureWishlist?.length">
            <label class="block text-sm font-medium text-gray-700">Future Wishlist</label>
            <ul class="list-disc list-inside text-sm text-gray-900 space-y-1">
              <li v-for="item in selectedInteraction.futureWishlist" :key="item">{{ item }}</li>
            </ul>
          </div>

          <div v-if="selectedInteraction.pmComments">
            <label class="block text-sm font-medium text-gray-700">PM Comments</label>
            <p class="text-sm text-gray-900">{{ selectedInteraction.pmComments }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import OnboardingModal from '../components/OnboardingModal.vue'
import InfoTooltip from '../components/InfoTooltip.vue'
import { useOnboarding } from '../composables/useOnboarding'
import { useComponentSelector } from '../composables/useComponentSelector'

const { showOnboarding, markOnboardingComplete } = useOnboarding()
const { components, selectedComponent } = useComponentSelector()

const statuses = ['Lead', 'Discovery', 'Evaluating', 'Feedback Received', 'Closed']
const selectedInteraction = ref(null)
const searchQuery = ref('')
const interactions = ref([])
const isLoading = ref(true)
const loadError = ref(null)

async function loadInteractions() {
  isLoading.value = true
  loadError.value = null

  try {
    const params = new URLSearchParams()
    if (selectedComponent.value && selectedComponent.value !== 'all') {
      params.append('component', selectedComponent.value)
    }

    const url = `/api/modules/customer-insights/interactions?${params}`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    interactions.value = data
  } catch (err) {
    loadError.value = err.message
    console.error('Error loading interactions:', err)
  } finally {
    isLoading.value = false
  }
}

// Watch for component filter changes
watch(selectedComponent, loadInteractions)

// Load on mount
onMounted(loadInteractions)

function handleOnboardingComplete() {
  markOnboardingComplete()
  loadInteractions()
}

const filteredInteractions = computed(() => {
  if (!searchQuery.value) {
    return interactions.value
  }

  const query = searchQuery.value.toLowerCase()
  return interactions.value.filter(i =>
    i.customerCompany?.toLowerCase().includes(query)
  )
})

const interactionsByStatus = computed(() => {
  const grouped = {}
  statuses.forEach(status => {
    grouped[status] = filteredInteractions.value.filter(i => i.status === status)
  })
  return grouped
})

function componentBadgeClass(component) {
  const classes = {
    // Inference & Model Serving
    'vLLM': 'text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded',
    'llm-d': 'text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded',
    'Model Serving': 'text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded',
    'Model Runtimes': 'text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded',
    'LlamaStack': 'text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded',
    // RAG & Data
    'RAG + Vector DB': 'text-xs bg-green-100 text-green-800 px-2 py-1 rounded',
    'AutoRAG': 'text-xs bg-green-100 text-green-800 px-2 py-1 rounded',
    'Data Processing': 'text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded',
    'Feature Store': 'text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded',
    // Training
    'Training': 'text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded',
    'Training Hub': 'text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded',
    'Fine Tuning': 'text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded',
    'SDG (Synthetic Data Generation)': 'text-xs bg-violet-100 text-violet-800 px-2 py-1 rounded',
    // Agents
    'Agentic': 'text-xs bg-pink-100 text-pink-800 px-2 py-1 rounded',
    'Agent Development': 'text-xs bg-pink-100 text-pink-800 px-2 py-1 rounded',
    'AgentOps': 'text-xs bg-fuchsia-100 text-fuchsia-800 px-2 py-1 rounded',
    // Platform & Tooling
    'Project Navigator': 'text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded',
    'Notebooks': 'text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded',
    'AI Hub': 'text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded',
    'AI Pipelines': 'text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded',
    'MLflow': 'text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded',
    // Observability & Safety
    'Model Observability': 'text-xs bg-cyan-100 text-cyan-800 px-2 py-1 rounded',
    'Explainability': 'text-xs bg-teal-100 text-teal-800 px-2 py-1 rounded',
    'AI Safety': 'text-xs bg-red-100 text-red-800 px-2 py-1 rounded',
    'Model Evaluation': 'text-xs bg-cyan-100 text-cyan-800 px-2 py-1 rounded',
  }
  return classes[component] || 'text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded'
}

function statusBadgeClass(status) {
  const classes = {
    'Lead': 'text-sm bg-gray-100 text-gray-800 px-2 py-1 rounded',
    'Discovery': 'text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded',
    'Evaluating': 'text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded',
    'Feedback Received': 'text-sm bg-green-100 text-green-800 px-2 py-1 rounded',
    'Closed': 'text-sm bg-purple-100 text-purple-800 px-2 py-1 rounded',
  }
  return classes[status] || classes['Lead']
}
</script>
