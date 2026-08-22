<template>
  <div class="p-6 max-w-5xl mx-auto">
    <!-- Header -->
    <div class="mb-6">
      <div class="flex items-center gap-2 mb-1">
        <h1 class="text-2xl font-bold text-gray-900">Generate RFE Summary</h1>
        <InfoTooltip text="Generate a well-formatted RFE summary from customer feedback that you can copy and paste into Jira. AI analyzes pain points and structures the content following Red Hat PM best practices." />
      </div>
      <p class="text-gray-600 mt-1">Transform customer pain points into structured RFE content</p>
    </div>

    <!-- Input Form -->
    <div class="bg-white rounded-lg shadow p-6 space-y-6 mb-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">RFE Details</h2>

      <!-- Source Interaction Selector -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Source Customer Interaction (Optional)
        </label>
        <select
          v-model="selectedInteractionId"
          class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          @change="populateFromInteraction"
        >
          <option value="">-- Select an interaction --</option>
          <option v-for="interaction in interactions" :key="interaction.id" :value="interaction.id">
            {{ interaction.customerCompany }} - {{ interaction.contactName }} ({{ interaction.component }})
          </option>
        </select>
        <p class="text-xs text-gray-500 mt-1">Pre-fill RFE details from a customer interaction</p>
      </div>

      <!-- Component -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Component <span class="text-red-500">*</span>
        </label>
        <select
          v-model="rfeData.component"
          class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          required
        >
          <option value="">-- Select component --</option>
          <optgroup v-for="pillar in pillars" :key="pillar.name" :label="pillar.name">
            <option v-for="c in pillar.components" :key="c.id" :value="c.id">
              {{ c.label }}
            </option>
          </optgroup>
        </select>
      </div>

      <!-- Title -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          RFE Title <span class="text-red-500">*</span>
        </label>
        <input
          v-model="rfeData.title"
          type="text"
          placeholder="e.g., Enhanced GPU scheduling for air-gapped environments"
          class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          required
        />
      </div>

      <!-- Customer Context -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Affected Customers <span class="text-red-500">*</span>
        </label>
        <textarea
          v-model="rfeData.customers"
          rows="2"
          placeholder="List specific customer names and segments..."
          class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          required
        ></textarea>
        <p class="text-xs text-gray-500 mt-1">Be specific - name actual customers, not "all users"</p>
      </div>

      <!-- Pain Points -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Pain Points / User Problem <span class="text-red-500">*</span>
        </label>
        <textarea
          v-model="rfeData.painPoints"
          rows="4"
          placeholder="What problem are customers experiencing? Describe from their perspective..."
          class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          required
        ></textarea>
        <p class="text-xs text-gray-500 mt-1">Focus on WHAT they can't do, not HOW to fix it</p>
      </div>

      <!-- Business Justification -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Business Justification <span class="text-red-500">*</span>
        </label>
        <textarea
          v-model="rfeData.businessJustification"
          rows="3"
          placeholder="Revenue impact, customer commitments, strategic importance..."
          class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          required
        ></textarea>
        <p class="text-xs text-gray-500 mt-1">Evidence-based: numbers, contracts, competitive positioning</p>
      </div>

      <!-- Success Criteria -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Success Criteria (Optional)
        </label>
        <textarea
          v-model="rfeData.successCriteria"
          rows="2"
          placeholder="How would customers know the problem is solved?"
          class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        ></textarea>
        <p class="text-xs text-gray-500 mt-1">Think outcomes, not features</p>
      </div>

      <!-- Action Buttons -->
      <div class="flex justify-end space-x-3 pt-4">
        <button
          @click="clearForm"
          class="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Clear
        </button>
        <button
          @click="checkSimilarRfes"
          :disabled="!canSearchSimilar || searchingRfes"
          class="px-6 py-2 border border-amber-400 bg-amber-50 text-amber-800 font-medium rounded-md hover:bg-amber-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <svg v-if="searchingRfes" class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span>{{ searchingRfes ? 'Searching...' : 'Check for Similar RFEs' }}</span>
        </button>
        <button
          @click="generateRfeSummary"
          :disabled="!canGenerate || generating"
          class="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <svg v-if="generating" class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>{{ generating ? 'Generating...' : 'Generate RFE Summary' }}</span>
        </button>
      </div>
    </div>

    <!-- Similar RFEs Results -->
    <div v-if="showSimilarResults" class="bg-white rounded-lg shadow p-6 mb-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900">Similar RFEs in Jira</h2>
        <button @click="showSimilarResults = false" class="text-gray-400 hover:text-gray-600">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div v-if="similarWarning" class="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
        <p class="text-amber-800 text-sm">{{ similarWarning }}</p>
      </div>

      <div v-if="searchingRfes" class="flex justify-center py-6">
        <svg class="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>

      <div v-else-if="similarRfes.length > 0" class="space-y-3">
        <p class="text-sm text-gray-600 mb-3">
          Found {{ similarRfes.length }} potentially similar RFE(s). Review before creating a new one.
        </p>
        <div
          v-for="rfe in similarRfes"
          :key="rfe.key"
          class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
        >
          <div class="flex items-start justify-between">
            <div class="min-w-0">
              <a
                :href="rfe.url"
                target="_blank"
                rel="noopener"
                class="text-blue-600 hover:text-blue-800 font-medium"
              >{{ rfe.key }}</a>
              <span class="text-gray-800 ml-2">{{ rfe.summary }}</span>
            </div>
            <div class="flex items-center space-x-2 ml-4 flex-shrink-0">
              <span
                class="px-2 py-1 text-xs rounded-full"
                :class="statusClass(rfe.status)"
              >{{ rfe.status }}</span>
              <span class="text-xs text-gray-500">{{ rfe.priority }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="!similarWarning" class="text-center py-6 text-gray-500">
        <p>No similar RFEs found. You're good to create a new one.</p>
      </div>
    </div>

    <!-- Generated Summary -->
    <div v-if="generatedSummary" class="bg-white rounded-lg shadow p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900">Generated RFE Summary</h2>
        <button
          @click="copyToClipboard"
          class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center space-x-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          <span>Copy to Clipboard</span>
        </button>
      </div>

      <div class="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <pre class="whitespace-pre-wrap text-sm font-mono text-gray-800">{{ generatedSummary }}</pre>
      </div>

      <p class="text-sm text-gray-600 mt-4">
        💡 <strong>Next step:</strong> Copy this summary and paste it into a new Jira RFE issue in the RHAIRFE project.
      </p>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mt-6">
      <p class="text-red-800">❌ Error: {{ error }}</p>
    </div>

    <!-- Success Message -->
    <div v-if="copied" class="fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg">
      ✓ Copied to clipboard!
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import InfoTooltip from '../components/InfoTooltip.vue'
import { useComponentSelector } from '../composables/useComponentSelector'
import { useRfeCreator } from '../composables/useRfeCreator'

const { pillars } = useComponentSelector()
const { searchSimilar, loading: searchingRfes } = useRfeCreator()
const moduleNav = inject('moduleNav')

const interactions = ref([])
const selectedInteractionId = ref('')
const generating = ref(false)
const generatedSummary = ref('')
const error = ref(null)
const copied = ref(false)
const similarRfes = ref([])
const similarWarning = ref(null)
const showSimilarResults = ref(false)

const rfeData = ref({
  component: '',
  title: '',
  customers: '',
  painPoints: '',
  businessJustification: '',
  successCriteria: ''
})

const canGenerate = computed(() => {
  return rfeData.value.component &&
         rfeData.value.title &&
         rfeData.value.customers &&
         rfeData.value.painPoints &&
         rfeData.value.businessJustification
})

const canSearchSimilar = computed(() => {
  return rfeData.value.title && rfeData.value.title.trim().length >= 3
})

onMounted(async () => {
  // Load interactions for selection
  try {
    const response = await fetch('/api/modules/customer-insights/interactions')
    if (response.ok) {
      interactions.value = await response.json()
    }
  } catch (err) {
    console.error('Failed to load interactions:', err)
  }

  // Prefill from navigation params (e.g. roadmap "Create RFE" button)
  const params = moduleNav?.params?.value
  if (params?.prefill) {
    if (params.component) rfeData.value.component = params.component
    if (params.title) rfeData.value.title = params.title
    if (params.businessJustification) rfeData.value.businessJustification = params.businessJustification
    if (params.useCases) rfeData.value.painPoints = params.useCases
    if (params.successMetrics) rfeData.value.successCriteria = params.successMetrics
    if (params.sourceCustomers) {
      rfeData.value.customers = params.sourceCustomers.split(',').join(', ')
    }
  }
})

function populateFromInteraction() {
  const interaction = interactions.value.find(i => i.id === selectedInteractionId.value)
  if (!interaction) return

  rfeData.value.component = interaction.component || ''
  rfeData.value.customers = `${interaction.customerCompany} (${interaction.industryVertical || 'N/A'})`
  rfeData.value.painPoints = interaction.painPoints || ''
  rfeData.value.businessJustification = interaction.featureFeedback || ''

  // Generate title from main use case or pain points
  if (interaction.mainAIUseCase) {
    rfeData.value.title = `Enhanced support for ${interaction.mainAIUseCase}`
  } else if (interaction.futureWishlist && Array.isArray(interaction.futureWishlist) && interaction.futureWishlist.length > 0) {
    rfeData.value.title = interaction.futureWishlist[0]
  }
}

async function generateRfeSummary() {
  generating.value = true
  error.value = null
  generatedSummary.value = ''

  try {
    const response = await fetch('/api/modules/customer-insights/rfe/generate-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rfeData.value)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to generate RFE summary')
    }

    const result = await response.json()
    generatedSummary.value = result.summary
  } catch (err) {
    console.error('Error generating RFE:', err)
    error.value = err.message
  } finally {
    generating.value = false
  }
}

async function checkSimilarRfes() {
  similarRfes.value = []
  similarWarning.value = null
  showSimilarResults.value = true

  try {
    const { similar, warning } = await searchSimilar({
      title: rfeData.value.title,
      component: rfeData.value.component,
      painPoints: rfeData.value.painPoints,
    })
    similarRfes.value = similar
    if (warning) similarWarning.value = warning
  } catch (err) {
    similarWarning.value = err.message
  }
}

function statusClass(status) {
  const lower = (status || '').toLowerCase()
  if (lower.includes('done') || lower.includes('closed') || lower.includes('resolved'))
    return 'bg-green-100 text-green-800'
  if (lower.includes('progress') || lower.includes('review'))
    return 'bg-blue-100 text-blue-800'
  return 'bg-gray-100 text-gray-800'
}

function clearForm() {
  selectedInteractionId.value = ''
  rfeData.value = {
    component: '',
    title: '',
    customers: '',
    painPoints: '',
    businessJustification: '',
    successCriteria: ''
  }
  generatedSummary.value = ''
  error.value = null
  similarRfes.value = []
  similarWarning.value = null
  showSimilarResults.value = false
}

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(generatedSummary.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 3000)
  } catch (err) {
    console.error('Failed to copy:', err)
    error.value = 'Failed to copy to clipboard'
  }
}
</script>
