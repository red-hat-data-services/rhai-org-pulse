<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  cardCounts: { type: Object, default: null },
  planningDeadline: { type: Object, default: null },
  releasePhaseMode: { type: String, default: 'unknown' },
  planningReadiness: { type: Object, default: null },
  fpdorReadiness: { type: Object, default: null }
})

var emit = defineEmits(['filterByCheck'])

var showDetails = ref(false)
var activeCard = ref('')

var isPlanningMode = computed(function() {
  return props.releasePhaseMode === 'planning' && props.planningReadiness != null
})

var planningCards = computed(function() {
  var p = props.planningReadiness || {}
  var byCheck = p.byCheck || {}
  return [
    { label: 'Planning Ready', count: p.fullyReady || 0, total: p.totalChecked || 0, color: 'green', filterKey: 'all-clear' },
    { label: 'Hard Blockers', count: p.withHardBlockers || 0, total: p.totalChecked || 0, color: 'red', invert: true, filterKey: 'has-blockers' },
    { label: 'RFE Linked', count: byCheck['DoR-P5'] || 0, total: p.totalChecked || 0, color: 'indigo', filterKey: 'missing-rfe' },
    { label: 'Epics Created', count: byCheck['DoR-P4'] || 0, total: p.totalChecked || 0, color: 'blue', filterKey: 'missing-epics' }
  ]
})

function handleCardClick(card) {
  if (activeCard.value === card.filterKey) {
    activeCard.value = ''
    emit('filterByCheck', '')
  } else {
    activeCard.value = card.filterKey
    emit('filterByCheck', card.filterKey)
  }
}

var primaryCards = computed(function() {
  var c = props.cardCounts || { total: 0, stratSignedOff: 0, riceComplete: 0 }
  var fr = props.fpdorReadiness || null
  return [
    { label: 'FPDoR Ready', count: fr ? fr.fullyPassed : 0, total: fr ? fr.totalFeatures : c.total, color: 'indigo' },
    { label: 'Strategy Signed Off', count: c.stratSignedOff, total: c.total, color: 'blue' },
    { label: 'RICE Complete', count: c.riceComplete, total: c.total, color: 'green' }
  ]
})

var detailCards = computed(function() {
  var c = props.cardCounts || { total: 0, ownerAssigned: 0, versionSet: 0, unblocked: 0, escalatedBlockers: 0 }
  return [
    { label: 'Owner Assigned', count: c.ownerAssigned, total: c.total, color: 'blue' },
    { label: 'Version Set', count: c.versionSet, total: c.total, color: 'indigo' },
    { label: 'Unblocked', count: c.unblocked, total: c.total, color: 'green' },
    { label: 'Escalated Blockers', count: c.escalatedBlockers, total: c.total, color: 'red', invert: true }
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
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-500/10',
    border: 'border-red-200 dark:border-red-500/30',
    text: 'text-red-700 dark:text-red-400',
    subtext: 'text-red-600/70 dark:text-red-400/70',
    barBg: 'bg-red-200 dark:bg-red-500/20',
    bar: 'bg-red-500 dark:bg-red-400'
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
  <div v-if="cardCounts || isPlanningMode" class="space-y-3">
    <!-- Planning mode cards -->
    <template v-if="isPlanningMode">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          v-for="card in planningCards"
          :key="card.label"
          type="button"
          class="p-4 rounded-lg border text-left cursor-pointer transition-shadow"
          :class="[
            colorClasses[card.color].bg,
            colorClasses[card.color].border,
            activeCard === card.filterKey ? 'ring-2 ring-offset-1 ring-indigo-400 dark:ring-indigo-500 shadow-md' : 'hover:shadow-sm'
          ]"
          :aria-pressed="activeCard === card.filterKey"
          @click="handleCardClick(card)"
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
              role="progressbar"
              :aria-valuenow="card.count"
              :aria-valuemin="0"
              :aria-valuemax="card.total"
              :aria-label="card.label + ' progress'"
            ></div>
          </div>
        </button>
      </div>
      <div v-if="fpdorReadiness" class="mt-3 p-3 rounded-lg border bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 flex items-center gap-3">
        <span class="text-sm font-semibold text-indigo-700 dark:text-indigo-400">FPDoR Ready</span>
        <span class="text-2xl font-bold text-indigo-700 dark:text-indigo-400">{{ fpdorReadiness.fullyPassed }}</span>
        <span class="text-sm text-indigo-600/70 dark:text-indigo-400/70">/ {{ fpdorReadiness.totalFeatures }}</span>
      </div>
    </template>

    <!-- Execution mode cards -->
    <template v-else-if="cardCounts">
      <!-- Primary cards (Row 1) -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          v-for="card in primaryCards"
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
              role="progressbar"
              :aria-valuenow="card.count"
              :aria-valuemin="0"
              :aria-valuemax="card.total"
              :aria-label="card.label + ' progress'"
            ></div>
          </div>
        </div>
      </div>

      <!-- Detail toggle -->
      <button
        @click="showDetails = !showDetails"
        class="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
      >
        <svg
          class="w-3.5 h-3.5 transition-transform"
          :class="showDetails ? 'rotate-90' : ''"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        {{ showDetails ? 'Hide' : 'Show' }} details
      </button>

      <!-- Detail cards (Row 2) -->
      <div v-if="showDetails" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          v-for="card in detailCards"
          :key="card.label"
          class="p-4 rounded-lg border"
          :class="[colorClasses[card.color].bg, colorClasses[card.color].border]"
        >
          <div class="text-sm font-semibold" :class="colorClasses[card.color].text">{{ card.label }}</div>
          <div class="mt-2">
            <span class="text-2xl font-bold" :class="colorClasses[card.color].text">{{ card.count }}</span>
            <span v-if="!card.invert" class="text-sm ml-0.5" :class="colorClasses[card.color].subtext">/ {{ card.total }}</span>
          </div>
          <div v-if="!card.invert" class="text-xs mt-0.5" :class="colorClasses[card.color].subtext">{{ pct(card.count, card.total) }}%</div>
          <div v-if="!card.invert" class="mt-2 w-full rounded-full h-1.5" :class="colorClasses[card.color].barBg">
            <div
              class="h-1.5 rounded-full transition-all"
              :class="colorClasses[card.color].bar"
              :style="{ width: Math.min(pct(card.count, card.total), 100) + '%' }"
              role="progressbar"
              :aria-valuenow="card.count"
              :aria-valuemin="0"
              :aria-valuemax="card.total"
              :aria-label="card.label + ' progress'"
            ></div>
          </div>
        </div>
      </div>
    </template>

    <!-- Planning deadline indicator -->
    <div v-if="planningDeadline" class="p-3 rounded-lg border flex items-center gap-3" :class="deadlineColorClass">
      <span class="text-sm font-semibold">Planning Deadline</span>
      <span class="text-sm">
        <span class="font-bold">{{ Math.abs(planningDeadline.daysRemaining) }}</span>
        {{ Math.abs(planningDeadline.daysRemaining) === 1 ? 'day' : 'days' }} {{ planningDeadline.daysRemaining >= 0 ? 'remaining' : 'overdue' }}
      </span>
      <span class="text-xs opacity-70">{{ planningDeadline.date }}</span>
    </div>
  </div>
</template>
