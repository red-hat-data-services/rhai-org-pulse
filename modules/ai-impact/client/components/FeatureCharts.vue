<script setup>
import { computed } from 'vue'
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
  features: { type: Object, default: () => ({}) }
})

const featureList = computed(() => Object.values(props.features))

// Score Distribution: histogram of scores.total (0-8)
const scoreDistributionData = computed(() => {
  const buckets = Array(9).fill(0)
  for (const f of featureList.value) {
    const total = f.scores?.total ?? 0
    if (total >= 0 && total <= 8) buckets[total]++
  }
  return {
    labels: ['0', '1', '2', '3', '4', '5', '6', '7', '8'],
    datasets: [{
      label: 'Features',
      data: buckets,
      backgroundColor: buckets.map((_, i) => {
        if (i <= 2) return 'rgba(239, 68, 68, 0.7)'    // red for low
        if (i <= 5) return 'rgba(245, 158, 11, 0.7)'    // amber for mid
        return 'rgba(16, 185, 129, 0.7)'                 // green for high
      })
    }]
  }
})

const scoreDistributionOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: { display: true, text: 'Score Distribution' },
    legend: { display: false }
  },
  scales: {
    x: { title: { display: true, text: 'Total Score' } },
    y: { title: { display: true, text: 'Count' }, beginAtZero: true, ticks: { stepSize: 1 } }
  }
}

// Dimension Breakdown: stacked bar showing pass(2)/partial(1)/fail(0) per dimension
const dimensionBreakdownData = computed(() => {
  const dims = ['feasibility', 'testability', 'scope', 'architecture']
  const counts = { pass: [], partial: [], fail: [] }

  for (const dim of dims) {
    let pass = 0, partial = 0, fail = 0
    for (const f of featureList.value) {
      const score = f.scores?.[dim] ?? 0
      if (score === 2) pass++
      else if (score === 1) partial++
      else fail++
    }
    counts.pass.push(pass)
    counts.partial.push(partial)
    counts.fail.push(fail)
  }

  return {
    labels: dims.map(d => d.charAt(0).toUpperCase() + d.slice(1)),
    datasets: [
      { label: 'Pass (2)', data: counts.pass, backgroundColor: 'rgba(16, 185, 129, 0.7)' },
      { label: 'Partial (1)', data: counts.partial, backgroundColor: 'rgba(245, 158, 11, 0.7)' },
      { label: 'Fail (0)', data: counts.fail, backgroundColor: 'rgba(239, 68, 68, 0.7)' }
    ]
  }
})

const dimensionBreakdownOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    title: { display: true, text: 'Dimension Breakdown' },
    legend: { display: true, position: 'bottom' }
  },
  scales: {
    x: { stacked: true },
    y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } }
  }
}
</script>

<template>
  <div v-if="featureList.length > 0" class="p-6 border-b border-gray-200 dark:border-gray-700">
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
