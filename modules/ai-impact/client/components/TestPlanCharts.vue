<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const props = defineProps({
  testPlans: { type: Object, default: () => ({}) }
})

const planList = computed(() => Object.values(props.testPlans))

const isDark = ref(false)
onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark') ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const observer = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark')
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  onBeforeUnmount(() => observer.disconnect())
})

const textColor = computed(() => isDark.value ? 'rgba(209, 213, 219, 1)' : 'rgba(107, 114, 128, 1)')
const gridColor = computed(() => isDark.value ? 'rgba(75, 85, 99, 0.5)' : 'rgba(229, 231, 235, 1)')

const scoreDistributionData = computed(() => {
  const buckets = Array(11).fill(0)
  for (const p of planList.value) {
    const score = p.score ?? 0
    if (score >= 0 && score <= 10) buckets[score]++
  }
  return {
    labels: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    datasets: [{
      label: 'Test Plans',
      data: buckets,
      backgroundColor: buckets.map((_, i) => {
        if (i <= 3) return 'rgba(239, 68, 68, 0.7)'
        if (i <= 7) return 'rgba(245, 158, 11, 0.7)'
        return 'rgba(16, 185, 129, 0.7)'
      })
    }]
  }
})

const scoreDistributionOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: { display: true, text: 'Score Distribution', color: textColor.value },
    legend: { display: false }
  },
  scales: {
    x: { title: { display: true, text: 'Quality Score', color: textColor.value }, ticks: { color: textColor.value }, grid: { color: gridColor.value } },
    y: { title: { display: true, text: 'Count', color: textColor.value }, beginAtZero: true, ticks: { stepSize: 1, color: textColor.value }, grid: { color: gridColor.value } }
  }
}))

const DIMENSIONS = [
  { key: 'specificity', label: 'Specificity' },
  { key: 'grounding', label: 'Grounding' },
  { key: 'scope_fidelity', label: 'Scope Fidelity' },
  { key: 'actionability', label: 'Actionability' },
  { key: 'consistency', label: 'Consistency' }
]

const dimensionBreakdownData = computed(() => {
  const counts = { pass: [], partial: [], fail: [] }

  for (const dim of DIMENSIONS) {
    let pass = 0, partial = 0, fail = 0
    for (const p of planList.value) {
      const score = p.scores?.[dim.key] ?? 0
      if (score === 2) pass++
      else if (score === 1) partial++
      else fail++
    }
    counts.pass.push(pass)
    counts.partial.push(partial)
    counts.fail.push(fail)
  }

  return {
    labels: DIMENSIONS.map(d => d.label),
    datasets: [
      { label: 'Pass (2)', data: counts.pass, backgroundColor: 'rgba(16, 185, 129, 0.7)' },
      { label: 'Partial (1)', data: counts.partial, backgroundColor: 'rgba(245, 158, 11, 0.7)' },
      { label: 'Fail (0)', data: counts.fail, backgroundColor: 'rgba(239, 68, 68, 0.7)' }
    ]
  }
})

const dimensionBreakdownOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: { display: true, text: 'Dimension Breakdown', color: textColor.value },
    legend: { display: true, position: 'bottom', labels: { color: textColor.value } }
  },
  scales: {
    x: { stacked: true, ticks: { color: textColor.value }, grid: { color: gridColor.value } },
    y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1, color: textColor.value }, grid: { color: gridColor.value } }
  }
}))
</script>

<template>
  <div v-if="planList.length > 0" class="p-6 border-b border-gray-200 dark:border-gray-700">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="h-64">
        <Bar :data="scoreDistributionData" :options="scoreDistributionOptions" />
      </div>
      <div class="h-64">
        <Bar :data="dimensionBreakdownData" :options="dimensionBreakdownOptions" />
      </div>
    </div>
  </div>
</template>
