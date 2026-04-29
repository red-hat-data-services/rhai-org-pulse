<script setup>
import { computed } from 'vue'

const props = defineProps({
  cardCounts: { type: Object, default: null },
  planningDeadline: { type: Object, default: null }
})

var cards = computed(function() {
  var c = props.cardCounts || { total: 0, riceComplete: 0, ownerAssigned: 0, scopeEstimated: 0, dorComplete: 0 }
  return [
    {
      label: 'RICE Score Present',
      count: c.riceComplete,
      total: c.total,
      color: 'indigo'
    },
    {
      label: 'Owner Assigned',
      count: c.ownerAssigned,
      total: c.total,
      color: 'blue'
    },
    {
      label: 'Scope Estimated',
      count: c.scopeEstimated,
      total: c.total,
      color: 'amber'
    },
    {
      label: 'DoR Complete',
      count: c.dorComplete,
      total: c.total,
      color: 'green'
    }
  ]
})

function pct(count, total) {
  if (!total) return 0
  return Math.round((count / total) * 100)
}

var colorClasses = {
  indigo: {
    bg: 'bg-indigo-50 dark:bg-indigo-500/10',
    border: 'border-indigo-200 dark:border-indigo-500/30',
    text: 'text-indigo-700 dark:text-indigo-400',
    subtext: 'text-indigo-600/70 dark:text-indigo-400/70',
    barBg: 'bg-indigo-200 dark:bg-indigo-500/20',
    bar: 'bg-indigo-500 dark:bg-indigo-400'
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    border: 'border-blue-200 dark:border-blue-500/30',
    text: 'text-blue-700 dark:text-blue-400',
    subtext: 'text-blue-600/70 dark:text-blue-400/70',
    barBg: 'bg-blue-200 dark:bg-blue-500/20',
    bar: 'bg-blue-500 dark:bg-blue-400'
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/30',
    text: 'text-amber-700 dark:text-amber-400',
    subtext: 'text-amber-600/70 dark:text-amber-400/70',
    barBg: 'bg-amber-200 dark:bg-amber-500/20',
    bar: 'bg-amber-500 dark:bg-amber-400'
  },
  green: {
    bg: 'bg-green-50 dark:bg-green-500/10',
    border: 'border-green-200 dark:border-green-500/30',
    text: 'text-green-700 dark:text-green-400',
    subtext: 'text-green-600/70 dark:text-green-400/70',
    barBg: 'bg-green-200 dark:bg-green-500/20',
    bar: 'bg-green-500 dark:bg-green-400'
  }
}

var deadlineColorClass = computed(function() {
  if (!props.planningDeadline) return ''
  var days = props.planningDeadline.daysRemaining
  if (days < 0) return 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400'
  if (days <= 14) return 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30 text-yellow-700 dark:text-yellow-400'
  return 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30 text-green-700 dark:text-green-400'
})
</script>

<template>
  <div v-if="cardCounts" class="space-y-3">
    <!-- Readiness cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div
        v-for="card in cards"
        :key="card.label"
        class="p-4 rounded-lg border"
        :class="[colorClasses[card.color].bg, colorClasses[card.color].border]"
      >
        <div class="text-sm font-semibold" :class="colorClasses[card.color].text">{{ card.label }}</div>
        <div class="mt-2">
          <span class="text-2xl font-bold" :class="colorClasses[card.color].text">{{ card.count }}</span>
          <span class="text-sm ml-0.5" :class="colorClasses[card.color].subtext">/ {{ card.total }}</span>
        </div>
        <div class="text-xs mt-0.5" :class="colorClasses[card.color].subtext">{{ pct(card.count, card.total) }}%</div>
        <div class="mt-2 w-full rounded-full h-1.5" :class="colorClasses[card.color].barBg">
          <div
            class="h-1.5 rounded-full transition-all"
            :class="colorClasses[card.color].bar"
            :style="{ width: Math.min(pct(card.count, card.total), 100) + '%' }"
          ></div>
        </div>
      </div>
    </div>

    <!-- Planning deadline indicator -->
    <div v-if="planningDeadline" class="p-3 rounded-lg border flex items-center gap-3" :class="deadlineColorClass">
      <span class="text-sm font-semibold">Planning Deadline</span>
      <span class="text-sm">
        <span class="font-bold">{{ planningDeadline.daysRemaining }}</span>
        {{ planningDeadline.daysRemaining === 1 ? 'day' : 'days' }} {{ planningDeadline.daysRemaining >= 0 ? 'remaining' : 'overdue' }}
      </span>
      <span class="text-xs opacity-70">{{ planningDeadline.date }}</span>
    </div>
  </div>
</template>
