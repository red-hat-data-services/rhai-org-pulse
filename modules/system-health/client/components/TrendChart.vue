<template>
  <div class="bottom-panel">
    <h3>Execution Across Versions</h3>
    <p class="panel-sub">
      Aggregated passed-test trends per <strong>version</strong> across all components.
      All release milestones (EA1 + EA2 + GA) within a version are combined.
    </p>

    <div class="version-toggles">
      <label v-for="v in allVersions" :key="v">
        <input type="checkbox" :value="v" :checked="selectedVersions.includes(v)" @change="toggleVersion(v)">
        {{ v }}
      </label>
    </div>

    <div class="chart-container">
      <Line v-if="chartData.datasets.length" :data="chartData" :options="chartOptions" />
      <div v-else class="chart-empty">No version data to plot.</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const props = defineProps({
  // Normalized heatmap: array of { component, days: { date: { by_vr } } }
  components: {
    type: Array,
    default: () => []
  }
})

const LINE_COLORS = [
  '#2ed573', '#3498db', '#e17055', '#a29bfe', '#fdcb6e',
  '#6c5ce7', '#00cec9', '#fab1a0', '#ff6b81', '#70a1ff'
]

function normalizeVersion(v) {
  const base = String(v).split('-')[0]
  const parts = base.split('.')
  return parts.length >= 2 ? parts[0] + '.' + parts[1] : base
}

function friendlyDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return months[d.getMonth()] + ' ' + d.getDate()
}

// version -> { date -> passed }
const versionDayPassed = computed(() => {
  const map = {}
  props.components.forEach((comp) => {
    Object.entries(comp.days || {}).forEach(([date, day]) => {
      if (!day.by_vr) return
      Object.entries(day.by_vr).forEach(([vrKey, vr]) => {
        const v = normalizeVersion(vrKey.split('|')[0])
        map[v] = map[v] || {}
        map[v][date] = (map[v][date] || 0) + (vr.passed || 0)
      })
    })
  })
  return map
})

const allVersions = computed(() => Object.keys(versionDayPassed.value).sort())

const selectedVersions = ref([])

watch(allVersions, (versions) => {
  // Default: all versions selected on first data load.
  if (selectedVersions.value.length === 0 && versions.length) {
    selectedVersions.value = [...versions]
  } else {
    // Drop versions that no longer exist.
    selectedVersions.value = selectedVersions.value.filter((v) => versions.includes(v))
  }
}, { immediate: true })

function toggleVersion(v) {
  const idx = selectedVersions.value.indexOf(v)
  if (idx === -1) selectedVersions.value.push(v)
  else selectedVersions.value.splice(idx, 1)
}

const sortedDates = computed(() => {
  const set = new Set()
  Object.values(versionDayPassed.value).forEach((dayMap) => {
    Object.keys(dayMap).forEach((d) => set.add(d))
  })
  return Array.from(set).sort()
})

const chartData = computed(() => {
  const dates = sortedDates.value
  const datasets = []
  let ci = 0
  allVersions.value.forEach((v) => {
    if (!selectedVersions.value.includes(v)) return
    const color = LINE_COLORS[ci % LINE_COLORS.length]
    ci++
    const dayMap = versionDayPassed.value[v]
    datasets.push({
      label: `Version ${v} (passed)`,
      data: dates.map((d) => dayMap[d] || 0),
      borderColor: color,
      backgroundColor: color + '22',
      tension: 0.3,
      fill: false,
      pointRadius: 3,
      borderWidth: 2
    })
  })
  return { labels: dates.map(friendlyDate), datasets }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: { color: '#8899aa', usePointStyle: true, pointStyle: 'rect', padding: 14, font: { size: 11 } }
    }
  },
  scales: {
    x: { ticks: { color: '#6b8299', font: { size: 10 }, maxRotation: 45 }, grid: { color: 'rgba(30,73,118,.2)' } },
    y: { ticks: { color: '#6b8299', font: { size: 10 } }, grid: { color: 'rgba(30,73,118,.3)' }, beginAtZero: true }
  }
}
</script>

<style scoped>
.bottom-panel {
  background: #0d2137;
  border: 1px solid #1e4976;
  border-radius: 8px;
  padding: 20px;
  margin-top: 28px;
}

.bottom-panel h3 {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
}

.panel-sub {
  font-size: 12px;
  color: #8899aa;
  margin-bottom: 14px;
}

.version-toggles {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.version-toggles label {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  font-size: 12px;
  color: #ccc;
  background: #132f4c;
  border: 1px solid #1e4976;
  border-radius: 4px;
  padding: 4px 10px;
}

.version-toggles label:hover {
  border-color: #3a6ea5;
}

.version-toggles input[type="checkbox"] {
  accent-color: #5ea7ff;
}

.chart-container {
  position: relative;
  width: 100%;
  height: 320px;
}

.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #6b8299;
  font-size: 13px;
}
</style>
