<template>
  <div class="p-6">
    <!-- Header -->
    <div class="mb-6 flex justify-between items-center">
      <div class="flex items-center gap-2">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">AI Insights</h1>
          <p class="text-gray-600 mt-1">AI-generated insights from customer interactions</p>
        </div>
        <InfoTooltip text="AI-powered analysis of customer feedback patterns. Identifies common themes, pain points, and feature requests across interactions. Click 'Generate Insights' to analyze current data." />
      </div>

      <div class="flex gap-3 items-center">
        <!-- Component Selector -->
        <select
          v-model="selectedComponent"
          class="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option v-for="c in components" :key="c.id" :value="c.id">
            {{ c.label }}
          </option>
        </select>

        <!-- Generate Insights Button -->
        <button
          @click="generateInsights"
          :disabled="generating"
          class="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <svg v-if="generating" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ generating ? 'Generating...' : 'Generate Insights with AI' }}
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="text-gray-500">Loading insights...</div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
      <p class="text-red-800">Error loading insights: {{ error }}</p>
    </div>

    <!-- Insights Content -->
    <div v-else-if="insights && insights.painPoints" class="space-y-6">
      <!-- Latest Insights -->
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex justify-between items-start mb-4">
          <h2 class="text-xl font-semibold text-gray-900">Latest Insights</h2>
          <span class="text-sm text-gray-500">
            Generated {{ formatDate(insights.generatedAt) }}
          </span>
        </div>

        <div class="space-y-6">
          <!-- Pain Points -->
          <section>
            <h3 class="text-lg font-semibold text-gray-900 mb-3">Top Pain Points</h3>
            <ul class="space-y-2">
              <li
                v-for="(point, index) in insights.painPoints"
                :key="index"
                class="flex items-start"
              >
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 text-red-800 flex items-center justify-center text-xs font-medium mr-3 mt-0.5">
                  {{ index + 1 }}
                </span>
                <p class="text-gray-700">{{ point }}</p>
              </li>
            </ul>
          </section>

          <!-- Requested Features -->
          <section>
            <h3 class="text-lg font-semibold text-gray-900 mb-3">Most Requested Features</h3>
            <ul class="space-y-2">
              <li
                v-for="(feature, index) in insights.requestedFeatures"
                :key="index"
                class="flex items-start"
              >
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-xs font-medium mr-3 mt-0.5">
                  {{ index + 1 }}
                </span>
                <p class="text-gray-700">{{ feature }}</p>
              </li>
            </ul>
          </section>

          <!-- Customer Sentiment -->
          <section>
            <h3 class="text-lg font-semibold text-gray-900 mb-3">Customer Sentiment</h3>
            <p class="text-gray-700 leading-relaxed">{{ insights.sentiment }}</p>
          </section>

          <!-- Strategic Recommendations -->
          <section>
            <h3 class="text-lg font-semibold text-gray-900 mb-3">Strategic Recommendations</h3>
            <ol class="space-y-2">
              <li
                v-for="(rec, index) in insights.recommendations"
                :key="index"
                class="flex items-start"
              >
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-800 flex items-center justify-center text-xs font-medium mr-3 mt-0.5">
                  {{ index + 1 }}
                </span>
                <p class="text-gray-700">{{ rec }}</p>
              </li>
            </ol>
          </section>

          <!-- Competitive Signals -->
          <section v-if="insights.competitiveSignals?.length">
            <h3 class="text-lg font-semibold text-gray-900 mb-3">Competitive Landscape</h3>
            <ul class="list-disc list-inside space-y-1">
              <li v-for="signal in insights.competitiveSignals" :key="signal" class="text-gray-700">
                {{ signal }}
              </li>
            </ul>
          </section>

          <!-- Data Gaps -->
          <section v-if="insights.dataGaps?.length">
            <h3 class="text-lg font-semibold text-gray-900 mb-3">Data Gaps</h3>
            <ul class="list-disc list-inside space-y-1">
              <li v-for="gap in insights.dataGaps" :key="gap" class="text-gray-700">
                {{ gap }}
              </li>
            </ul>
          </section>
        </div>
      </div>

      <!-- Insights History -->
      <div v-if="history.length > 0" class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Insights History</h3>
        <div class="space-y-3">
          <div
            v-for="hist in history"
            :key="hist.id"
            class="border-l-4 border-primary-500 pl-4 py-2"
          >
            <p class="font-medium text-gray-900">{{ formatDate(hist.generatedAt) }}</p>
            <p class="text-sm text-gray-600">{{ hist.summary }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- No Data State -->
    <div v-else class="bg-white rounded-lg shadow p-12 text-center">
      <div class="text-gray-500 mb-4">
        <p class="font-medium text-lg mb-2">Coming Soon</p>
        <p class="text-sm">Click "Generate Insights with AI" above to analyze customer feedback.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import InfoTooltip from '../components/InfoTooltip.vue'
import { useComponentSelector } from '../composables/useComponentSelector'
import { useInsights } from '../composables/useInsights'

const { components, selectedComponent } = useComponentSelector()
const { insights, history, loading, error, refresh } = useInsights(selectedComponent)
const generating = ref(false)

async function generateInsights() {
  generating.value = true
  try {
    const response = await fetch('/api/modules/customer-insights/insights/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ component: selectedComponent.value })
    })

    if (!response.ok) {
      const errData = await response.json()
      throw new Error(errData.error || `HTTP ${response.status}`)
    }

    // Refresh the insights display
    await refresh()
  } catch (err) {
    alert(`Failed to generate insights: ${err.message}`)
  } finally {
    generating.value = false
  }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>
