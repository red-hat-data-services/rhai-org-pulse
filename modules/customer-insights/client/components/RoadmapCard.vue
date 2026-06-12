<template>
  <div
    class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
  >
    <div class="flex items-start justify-between mb-2">
      <div class="flex-1">
        <h3 class="font-semibold text-gray-900">{{ item.title }}</h3>
        <p class="text-sm text-gray-600 mt-1">{{ item.description }}</p>
      </div>
      <span :class="statusBadgeClass(item.status)" class="ml-3 flex-shrink-0">
        {{ item.status }}
      </span>
    </div>

    <div class="flex items-center gap-3 mt-3 text-sm text-gray-600">
      <!-- Customer Demand -->
      <div v-if="item.customerDemand" class="flex items-center gap-1">
        <span class="text-gray-400">👥</span>
        <span>{{ item.customerDemand.requestingCustomers }} customers</span>
      </div>

      <!-- Priority -->
      <div v-if="item.priority" class="flex items-center gap-1">
        <span
          class="w-2 h-2 rounded-full"
          :class="{
            'bg-red-500': item.priority === 'High',
            'bg-yellow-500': item.priority === 'Medium',
            'bg-gray-400': item.priority === 'Low',
          }"
        ></span>
        <span>{{ item.priority }}</span>
      </div>

      <!-- Target Quarter -->
      <div v-if="item.targetQuarter" class="flex items-center gap-1">
        <span class="text-gray-400">📅</span>
        <span>{{ item.targetQuarter }}</span>
      </div>

      <!-- Owner -->
      <div v-if="item.owner" class="flex items-center gap-1">
        <span class="text-gray-400">👤</span>
        <span>{{ item.owner.name }}</span>
      </div>
    </div>

    <!-- Progress Bar (if deliverables exist) -->
    <div v-if="item.deliverables && item.deliverables.length > 0" class="mt-3">
      <div class="flex items-center justify-between text-xs text-gray-600 mb-1">
        <span>Progress</span>
        <span>{{ completedCount }}/{{ item.deliverables.length }}</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2">
        <div
          class="bg-blue-600 h-2 rounded-full transition-all"
          :style="{ width: `${progressPercentage}%` }"
        ></div>
      </div>
    </div>

    <!-- Key Accounts Tags -->
    <div v-if="item.customerDemand?.keyAccounts?.length" class="mt-3 flex flex-wrap gap-1">
      <span
        v-for="account in item.customerDemand.keyAccounts.slice(0, 3)"
        :key="account"
        class="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded"
      >
        {{ account }}
      </span>
      <span
        v-if="item.customerDemand.keyAccounts.length > 3"
        class="text-xs text-gray-500"
      >
        +{{ item.customerDemand.keyAccounts.length - 3 }} more
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
})

const completedCount = computed(() => {
  if (!props.item.deliverables) return 0
  return props.item.deliverables.filter(d => d.completed).length
})

const progressPercentage = computed(() => {
  if (!props.item.deliverables || props.item.deliverables.length === 0) return 0
  return Math.round((completedCount.value / props.item.deliverables.length) * 100)
})

function statusBadgeClass(status) {
  const classes = {
    'Not Started': 'text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded',
    'In Progress': 'text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded',
    'In Review': 'text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded',
    'Completed': 'text-xs bg-green-100 text-green-800 px-2 py-1 rounded',
    'On Hold': 'text-xs bg-red-100 text-red-800 px-2 py-1 rounded',
  }
  return classes[status] || classes['Not Started']
}
</script>
