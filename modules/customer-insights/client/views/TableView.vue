<template>
  <div class="p-6">
    <!-- Header -->
    <div class="mb-6 flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Customer Interactions</h1>
        <p class="text-gray-600 mt-1">View and manage customer interactions</p>
      </div>

      <!-- Component Selector -->
      <select
        v-model="selectedComponent"
        class="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <option v-for="c in components" :key="c.id" :value="c.id">
          {{ c.label }}
        </option>
      </select>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="text-gray-500">Loading interactions...</div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
      <p class="text-red-800">Error loading interactions: {{ error }}</p>
    </div>

    <!-- Table -->
    <div v-else class="bg-white rounded-lg shadow overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Component</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Geo</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Industry</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-if="interactions.length === 0">
            <td colspan="6" class="px-6 py-12 text-center text-gray-500">
              Coming Soon
            </td>
          </tr>
          <tr
            v-for="item in interactions"
            :key="item.id"
            class="hover:bg-gray-50 cursor-pointer"
            @click="selectedInteraction = item"
          >
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm font-medium text-gray-900">{{ item.customerCompany }}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm text-gray-900">{{ item.contactName }}</div>
              <div class="text-sm text-gray-500">{{ item.fieldContactName }}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span :class="componentClass(item.component)">
                {{ item.component }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span :class="statusClass(item.status)">
                {{ item.status }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ item.geo }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ item.industryVertical }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Detail Modal (Simple for now) -->
    <div
      v-if="selectedInteraction"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      @click.self="selectedInteraction = null"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div class="flex justify-between items-start mb-4">
          <h2 class="text-xl font-bold">{{ selectedInteraction.customerCompany }}</h2>
          <div class="flex items-center space-x-2">
            <button
              @click="deleteInteraction(selectedInteraction.id)"
              class="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded border border-red-300"
            >
              Delete
            </button>
            <button @click="selectedInteraction = null" class="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Contact</label>
            <p class="text-sm text-gray-900">{{ selectedInteraction.contactName }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Field Contact</label>
            <p class="text-sm text-gray-900">{{ selectedInteraction.fieldContactName }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Main Use Case</label>
            <p class="text-sm text-gray-900">{{ selectedInteraction.mainAIUseCase }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Pain Points</label>
            <p class="text-sm text-gray-900">{{ selectedInteraction.painPoints }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">Future Wishlist</label>
            <ul class="list-disc list-inside text-sm text-gray-900">
              <li v-for="item in selectedInteraction.futureWishlist" :key="item">{{ item }}</li>
            </ul>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700">PM Comments</label>
            <p class="text-sm text-gray-900">{{ selectedInteraction.pmComments }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useComponentSelector } from '../composables/useComponentSelector'
import { useInteractions } from '../composables/useInteractions'

const { components, selectedComponent } = useComponentSelector()
const { interactions, loading, error } = useInteractions(selectedComponent)

const selectedInteraction = ref(null)

async function deleteInteraction(id) {
  if (!confirm('Are you sure you want to delete this interaction?')) {
    return
  }

  try {
    const response = await fetch(`/api/modules/customer-insights/interactions/${id}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      throw new Error('Failed to delete interaction')
    }

    // Close modal and reload data
    selectedInteraction.value = null
    // Trigger a reload by toggling the component filter or force refresh
    window.location.reload()
  } catch (err) {
    alert('Error deleting interaction: ' + err.message)
  }
}

function componentClass(component) {
  const classes = {
    'navigator': 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800',
    'autox': 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800',
    'platform': 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800',
    'd2ma': 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800',
    'agentic': 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-pink-100 text-pink-800',
    'inferencing': 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800',
  }
  return classes[component] || 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800'
}

function statusClass(status) {
  const classes = {
    'Lead': 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800',
    'Discovery': 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800',
    'Evaluating': 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800',
    'Feedback Received': 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800',
    'Closed': 'px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800',
  }
  return classes[status] || classes['Lead']
}
</script>
