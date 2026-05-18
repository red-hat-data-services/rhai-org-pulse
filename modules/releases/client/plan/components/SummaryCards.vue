<script setup>
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'

ChartJS.register(ArcElement, Tooltip)

var CHART_COLORS = {
  EA1: '#3b82f6',
  EA2: '#f59e0b',
  GA: '#10b981',
  '--': '#9ca3af'
}

const props = defineProps({
  summary: { type: Object, default: null },
  tier1HealthSummary: { type: Object, default: null },
  releaseDistribution: { type: Array, default: null }
})

const hasTier1Health = computed(function() {
  return props.tier1HealthSummary && props.tier1HealthSummary.byRisk
})

var doughnutData = computed(function() {
  if (!props.releaseDistribution) return null
  return {
    labels: props.releaseDistribution.map(function(r) { return r.label }),
    datasets: [{
      data: props.releaseDistribution.map(function(r) { return r.count }),
      backgroundColor: props.releaseDistribution.map(function(r) { return CHART_COLORS[r.label] || '#9ca3af' }),
      borderWidth: 0,
      hoverOffset: 4
    }]
  }
})

var doughnutOptions = {
  responsive: true,
  maintainAspectRatio: true,
  cutout: '60%',
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: function(ctx) {
          var item = props.releaseDistribution[ctx.dataIndex]
          return item.label + ': ' + item.count + ' (' + item.pct + '%)'
        }
      }
    }
  }
}

var totalFeatures = computed(function() {
  if (!props.releaseDistribution) return 0
  var sum = 0
  for (var i = 0; i < props.releaseDistribution.length; i++) {
    sum += props.releaseDistribution[i].count
  }
  return sum
})
</script>

<template>
  <div v-if="summary" class="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
    <!-- Card 1: Feature Summary -->
    <div class="p-4 rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30">
      <div class="text-sm font-semibold text-green-700 dark:text-green-400">Feature Summary</div>
      <div class="text-xs text-green-600/70 dark:text-green-400/70 mt-0.5 leading-snug">
        {{ summary.totalFeatures || 0 }} Features &nbsp; {{ summary.totalRfes || 0 }} RFEs
      </div>
      <!-- Per-tier breakdown table -->
      <table class="w-full mt-3 text-xs" aria-label="Feature and RFE counts by tier">
        <thead>
          <tr class="text-green-600/70 dark:text-green-400/70">
            <th class="text-left font-medium pr-3"></th>
            <th class="text-right font-medium px-2">Features</th>
            <th class="text-right font-medium pl-2">RFEs</th>
          </tr>
        </thead>
        <tbody class="text-green-700 dark:text-green-400 font-semibold">
          <tr>
            <td class="pr-3">Tier 1 <span class="font-normal text-green-600/50 dark:text-green-400/50">Essentials</span></td>
            <td class="text-right px-2">{{ summary.tier1 ? summary.tier1.features : 0 }}</td>
            <td class="text-right pl-2">{{ summary.tier1 ? summary.tier1.rfes : 0 }}</td>
          </tr>
          <tr>
            <td class="pr-3">Tier 2 <span class="font-normal text-green-600/50 dark:text-green-400/50">High-Value</span></td>
            <td class="text-right px-2">{{ summary.tier2 ? summary.tier2.features : 0 }}</td>
            <td class="text-right pl-2">{{ summary.tier2 ? summary.tier2.rfes : 0 }}</td>
          </tr>
          <tr>
            <td class="pr-3">Tier 3 <span class="font-normal text-green-600/50 dark:text-green-400/50">Team Priorities</span></td>
            <td class="text-right px-2">{{ summary.tier3 ? summary.tier3.features : 0 }}</td>
            <td class="text-right pl-2">{{ summary.tier3 ? summary.tier3.rfes : 0 }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Card 2: Tier 1 Health -->
    <div class="p-4 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
      <div class="text-sm font-semibold text-amber-700 dark:text-amber-400">Outcome Health</div>
      <div class="mt-2 text-sm text-amber-700 dark:text-amber-400">
        <span class="font-bold">{{ summary.tier1 ? summary.tier1.features : 0 }}</span>
        <span class="text-amber-600/70 dark:text-amber-400/70 ml-1">features tracked</span>
      </div>
      <!-- Health dots (Tier 1 only) -->
      <div v-if="hasTier1Health" class="space-y-1.5 mt-3 pt-2 border-t border-amber-200/50 dark:border-amber-500/20"
        :aria-label="'Tier 1 feature health: ' + (tier1HealthSummary.byRisk.green || 0) + ' on track, ' + (tier1HealthSummary.byRisk.yellow || 0) + ' at risk, ' + (tier1HealthSummary.byRisk.red || 0) + ' off track'"
      >
        <div class="flex items-center gap-2 text-xs">
          <span class="w-16 text-green-700 dark:text-green-400 font-medium">On track</span>
          <div class="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div class="h-full rounded-full bg-green-500" :style="{ width: ((tier1HealthSummary.byRisk.green || 0) / (summary.tier1 ? summary.tier1.features : 1) * 100) + '%' }"></div>
          </div>
          <span class="w-8 text-right font-semibold text-green-700 dark:text-green-400">{{ tier1HealthSummary.byRisk.green || 0 }}</span>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <span class="w-16 text-yellow-700 dark:text-yellow-400 font-medium">At risk</span>
          <div class="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div class="h-full rounded-full bg-yellow-500" :style="{ width: ((tier1HealthSummary.byRisk.yellow || 0) / (summary.tier1 ? summary.tier1.features : 1) * 100) + '%' }"></div>
          </div>
          <span class="w-8 text-right font-semibold text-yellow-700 dark:text-yellow-400">{{ tier1HealthSummary.byRisk.yellow || 0 }}</span>
        </div>
        <div class="flex items-center gap-2 text-xs">
          <span class="w-16 text-red-700 dark:text-red-400 font-medium">Off track</span>
          <div class="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div class="h-full rounded-full bg-red-500" :style="{ width: ((tier1HealthSummary.byRisk.red || 0) / (summary.tier1 ? summary.tier1.features : 1) * 100) + '%' }"></div>
          </div>
          <span class="w-8 text-right font-semibold text-red-700 dark:text-red-400">{{ tier1HealthSummary.byRisk.red || 0 }}</span>
        </div>
      </div>
      <div v-else class="space-y-1.5 mt-3 pt-2 border-t border-amber-200/50 dark:border-amber-500/20" aria-label="Loading health data">
        <div v-for="n in 3" :key="n" class="flex items-center gap-2">
          <div class="w-16 h-3 rounded bg-amber-200/50 dark:bg-amber-500/10 animate-pulse"></div>
          <div class="flex-1 h-2 rounded-full bg-amber-200/50 dark:bg-amber-500/10 animate-pulse"></div>
          <div class="w-8 h-3 rounded bg-amber-200/50 dark:bg-amber-500/10 animate-pulse"></div>
        </div>
      </div>
    </div>

    <!-- Card 3: Release Version -->
    <div class="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30">
      <div class="text-sm font-semibold text-indigo-700 dark:text-indigo-400">Milestone Coverage</div>
      <div class="text-xs text-indigo-600/70 dark:text-indigo-400/70 mt-0.5 leading-snug">Feature distribution by release phase</div>
      <template v-if="releaseDistribution && doughnutData">
        <div class="flex items-center gap-3 mt-3">
          <!-- Doughnut chart with center total -->
          <div class="relative w-24 h-24 flex-shrink-0">
            <Doughnut :data="doughnutData" :options="doughnutOptions" />
            <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span class="text-lg font-bold text-indigo-700 dark:text-indigo-400 leading-none">{{ totalFeatures }}</span>
              <span class="text-[9px] text-indigo-600/60 dark:text-indigo-400/60">total</span>
            </div>
          </div>
          <!-- Legend -->
          <dl class="flex-1 space-y-1 text-xs">
            <div v-for="r in releaseDistribution" :key="r.label" class="flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ backgroundColor: CHART_COLORS[r.label] || '#9ca3af' }"></span>
              <dt class="font-semibold text-indigo-700 dark:text-indigo-400 w-8">{{ r.label }}</dt>
              <dd class="text-indigo-600/70 dark:text-indigo-400/70">{{ r.count }} ({{ r.pct }}%)</dd>
            </div>
          </dl>
        </div>
      </template>
      <div v-else class="mt-3 text-xs text-indigo-600/50 dark:text-indigo-400/50 italic">
        No release version data available
      </div>
    </div>
  </div>
</template>
