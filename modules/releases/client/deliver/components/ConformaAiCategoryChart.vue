<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { AI_CATEGORIES, PERMANENT_TARGET, targetReleaseLabel, normalizeTargetRelease, policyLabel, policyColor, sortPolicyFiles } from '../constants/conforma'
import ConformaHelpText from './ConformaHelpText.vue'

const props = defineProps({
  exceptions: { type: Array, default: () => [] },
  releases: { type: Array, default: () => [] },
  chartKey: { type: Number, default: 0 }
})

const activePfs = computed(() =>
  sortPolicyFiles([...new Set(props.exceptions.map(e => e.policyFile).filter(Boolean))])
)

const categorized = computed(() => {
  const pfs = activePfs.value
  const cats = {}
  for (const [key, info] of Object.entries(AI_CATEGORIES)) {
    const entry = { ...info, total: 0 }
    for (const pf of pfs) entry[pf] = 0
    cats[key] = entry
  }
  for (const ex of props.exceptions) {
    if (ex.aiCategory && cats[ex.aiCategory]) {
      if (ex.policyFile && cats[ex.aiCategory][ex.policyFile] !== undefined) {
        cats[ex.aiCategory][ex.policyFile]++
      }
      cats[ex.aiCategory].total++
    }
  }
  return cats
})

const resolvedCount = computed(() => categorized.value.resolved?.total || 0)

const componentUpdateCount = computed(() => categorized.value.component_update?.total || 0)

const policyMappedCount = computed(() =>
  props.exceptions.filter(e => e.policyMapped === true).length
)

const permanentCount = computed(() => categorized.value.partner_permanent?.total || 0)

const categoryChartData = computed(() => {
  const entries = Object.entries(AI_CATEGORIES)
  const pfs = activePfs.value
  return {
    labels: entries.map(([, info]) => info.label),
    datasets: pfs.map(pf => {
      const color = policyColor(pf, pfs)
      return {
        label: policyLabel(pf),
        data: entries.map(([key]) => categorized.value[key]?.[pf] || 0),
        backgroundColor: color.bg,
        borderColor: color.border,
        borderWidth: 1,
        borderRadius: 3
      }
    })
  }
})

const categoryChartOptions = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } },
    tooltip: { mode: 'index' }
  },
  scales: {
    x: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(156,163,175,0.15)' } },
    y: { stacked: true, grid: { display: false } }
  }
}

const targetReleases = computed(() => {
  const targets = new Set()
  for (const ex of props.exceptions) {
    if (ex.targetRelease) targets.add(ex.targetRelease)
  }

  const gaDateMap = {}
  for (const r of props.releases) {
    if (r.version && r.gaDate) gaDateMap[normalizeTargetRelease(r.version)] = r.gaDate
  }

  const nonPermanent = [...targets].filter(t => t !== PERMANENT_TARGET)
  nonPermanent.sort((a, b) => {
    const da = gaDateMap[a] || '9999-' + a
    const db = gaDateMap[b] || '9999-' + b
    return da.localeCompare(db)
  })
  if (targets.has(PERMANENT_TARGET)) nonPermanent.push(PERMANENT_TARGET)
  return nonPermanent
})

const burndownData = computed(() => {
  const releases = targetReleases.value
  const byRelease = {}
  for (const t of releases) {
    byRelease[t] = {}
    for (const key of Object.keys(AI_CATEGORIES)) {
      byRelease[t][key] = 0
    }
  }
  for (const ex of props.exceptions) {
    if (ex.aiCategory && ex.targetRelease && byRelease[ex.targetRelease]) {
      byRelease[ex.targetRelease][ex.aiCategory]++
    }
  }
  const catEntries = Object.entries(AI_CATEGORIES)
  return {
    labels: releases.map(t => targetReleaseLabel(t)),
    datasets: catEntries.map(([key, info]) => ({
      label: info.label,
      data: releases.map(t => byRelease[t][key] || 0),
      backgroundColor: info.color,
      borderColor: info.borderColor,
      borderWidth: 1,
      borderRadius: 3
    }))
  }
})

const burndownOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { boxWidth: 12, padding: 8, font: { size: 10 } } },
    tooltip: { mode: 'index' }
  },
  scales: {
    x: { stacked: true, grid: { display: false } },
    y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(156,163,175,0.15)' } }
  }
}

const hasCategorizedData = computed(() =>
  props.exceptions.some(e => e.aiCategory)
)

const hasBurndownData = computed(() =>
  props.exceptions.some(e => e.targetRelease)
)
</script>

<template>
  <div v-if="hasCategorizedData" class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">AI Exception Analysis</h3>
      <ConformaHelpText
        good="'Resolved' and 'Component Update' exceptions are quick wins that reduce exception count"
        attention="'Policy Mapped' exceptions are compliance-blocking and need PRODSECRM risk tickets"
        action="Prioritize platform adoption and component updates to maximize exception reduction by 3.5 GA"
      />
    </div>

    <!-- Summary cards -->
    <div class="flex flex-wrap gap-3 mb-4">
      <div v-if="policyMappedCount > 0" class="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-2">
        <span class="text-2xl font-bold text-red-600 dark:text-red-400">{{ policyMappedCount }}</span>
        <span class="text-xs text-red-700 dark:text-red-300">Policy Mapped (blocking)</span>
      </div>
      <div v-if="resolvedCount > 0" class="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-4 py-2">
        <span class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{{ resolvedCount }}</span>
        <span class="text-xs text-emerald-700 dark:text-emerald-300">Resolved (removable)</span>
      </div>
      <div v-if="componentUpdateCount > 0" class="flex items-center gap-2 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg px-4 py-2">
        <span class="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{{ componentUpdateCount }}</span>
        <span class="text-xs text-cyan-700 dark:text-cyan-300">Component Updates</span>
      </div>
      <div v-if="permanentCount > 0" class="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg px-4 py-2">
        <span class="text-2xl font-bold text-slate-600 dark:text-slate-400">{{ permanentCount }}</span>
        <span class="text-xs text-slate-600 dark:text-slate-400">Permanent (partner)</span>
      </div>
    </div>

    <!-- Charts side by side -->
    <div class="grid gap-6" :class="hasBurndownData ? 'grid-cols-1 lg:grid-cols-2' : ''">
      <!-- Resolution Path Distribution -->
      <div>
        <h4 class="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Resolution Path Distribution</h4>
        <div style="height: 240px; position: relative;">
          <Bar :key="`ai-cat-${chartKey}`" :data="categoryChartData" :options="categoryChartOptions" />
        </div>
      </div>

      <!-- Release Burndown Forecast -->
      <div v-if="hasBurndownData">
        <h4 class="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Release Burndown Forecast</h4>
        <div style="height: 240px; position: relative;">
          <Bar :key="`burndown-${chartKey}`" :data="burndownData" :options="burndownOptions" />
        </div>
      </div>
    </div>
  </div>
</template>
