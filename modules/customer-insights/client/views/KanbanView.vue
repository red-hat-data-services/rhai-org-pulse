<template>
  <div class="p-6">
    <!-- Header -->
    <div class="mb-6 flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Customer Interactions</h1>
        <p class="text-gray-600 mt-1">All customer interactions across engagement stages</p>
      </div>

      <!-- Component Selector -->
      <select
        v-model="selectedComponent"
        class="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <option value="all">Portfolio (All)</option>
        <option value="navigator">Project Navigator</option>
        <option value="autox">AutoX</option>
        <option value="platform">AI Platform</option>
        <option value="d2ma">D2MA</option>
        <option value="agentic">Agentic</option>
        <option value="inferencing">Inferencing</option>
      </select>
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

const statuses = ['Lead', 'Discovery', 'Evaluating', 'Feedback Received', 'Closed']
const selectedInteraction = ref(null)
const selectedComponent = ref('all')
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

const interactionsByStatus = computed(() => {
  const grouped = {}
  statuses.forEach(status => {
    grouped[status] = interactions.value.filter(i => i.status === status)
  })
  return grouped
})

function componentBadgeClass(component) {
  const classes = {
    'navigator': 'text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded',
    'autox': 'text-xs bg-green-100 text-green-800 px-2 py-1 rounded',
    'platform': 'text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded',
    'd2ma': 'text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded',
    'agentic': 'text-xs bg-pink-100 text-pink-800 px-2 py-1 rounded',
    'inferencing': 'text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded',
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
