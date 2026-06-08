<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { Bar, Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend)

const props = defineProps({
  data: { type: Object, default: null }
})

const isDark = ref(false)
const noReviewPopover = ref(null)
let darkObserver = null
onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
  darkObserver = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark')
  })
  darkObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})
function onDocClick(e) {
  if (noReviewPopover.value && !e.target.closest('.no-review-popover')) {
    noReviewPopover.value = null
  }
}
onMounted(() => { document.addEventListener('click', onDocClick, true) })
onBeforeUnmount(() => { if (darkObserver) darkObserver.disconnect(); document.removeEventListener('click', onDocClick, true) })

const textColor = computed(() => isDark.value ? 'rgba(209, 213, 219, 1)' : 'rgba(107, 114, 128, 1)')
const gridColor = computed(() => isDark.value ? 'rgba(75, 85, 99, 0.5)' : 'rgba(229, 231, 235, 1)')

const activeMrs = computed(() => {
  if (!props.data?.mergeRequests) return []
  return props.data.mergeRequests.filter(mr => mr.state !== 'closed')
})

const mergedMrs = computed(() => activeMrs.value.filter(mr => mr.state === 'merged'))
const openMrs = computed(() => activeMrs.value.filter(mr => mr.state === 'opened'))

const hasData = computed(() => activeMrs.value.length > 0)

// ─── Graph D: Commits Distribution ───

const commitsDistData = computed(() => {
  const mergedCounts = {}
  const openCounts = {}
  for (const mr of activeMrs.value) {
    const c = mr.commitCount || 1
    if (mr.state === 'merged') mergedCounts[c] = (mergedCounts[c] || 0) + 1
    else openCounts[c] = (openCounts[c] || 0) + 1
  }
  const allKeys = new Set([...Object.keys(mergedCounts), ...Object.keys(openCounts)].map(Number))
  const max = Math.max(...allKeys, 0)
  const labels = []
  const mergedData = []
  const openData = []
  for (let i = 1; i <= max; i++) {
    labels.push(String(i))
    mergedData.push(mergedCounts[i] || 0)
    openData.push(openCounts[i] || 0)
  }
  return {
    labels,
    datasets: [
      {
        label: 'Open',
        data: openData,
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
        borderColor: '#10b981',
        borderWidth: 1,
        stack: 'commits'
      },
      {
        label: 'Merged',
        data: mergedData,
        backgroundColor: 'rgba(99, 102, 241, 0.7)',
        borderColor: '#6366f1',
        borderWidth: 1,
        stack: 'commits'
      }
    ]
  }
})

const commitsDistOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: 'top', labels: { font: { size: 9 }, color: textColor.value, boxWidth: 10 } },
    tooltip: {
      callbacks: {
        label(ctx) { return `${ctx.dataset.label}: ${ctx.parsed.y} MR${ctx.parsed.y !== 1 ? 's' : ''}` }
      }
    }
  },
  scales: {
    x: { stacked: true, title: { display: true, text: 'Commits', font: { size: 10 }, color: textColor.value }, ticks: { font: { size: 9 }, color: textColor.value }, grid: { color: gridColor.value } },
    y: { stacked: true, beginAtZero: true, ticks: { font: { size: 10 }, color: textColor.value, precision: 0 }, title: { display: true, text: 'MRs', font: { size: 10 }, color: textColor.value }, grid: { color: gridColor.value } }
  }
}))

// ─── Graph E: AI Draft Maturity Score ───
// score = 1 / (1 + α·(commits−1) + β·comments), α=0.3, β=0.1

function draftMaturityScore(commitCount, commentCount) {
  const commits = commitCount || 1
  const comments = commentCount || 0
  return 1 / (1 + 0.3 * (commits - 1) + 0.1 * comments)
}

function getISOWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

const overallMaturity = computed(() => {
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const recentMerged = mergedMrs.value.filter(mr => new Date(mr.mergedAt) >= threeMonthsAgo)
  if (!recentMerged.length) return null
  const scores = recentMerged.map(mr => draftMaturityScore(mr.commitCount, mr.commentCount))
  return +(scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(2)
})

const readinessTrendData = computed(() => {
  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const recentMrs = mergedMrs.value.filter(mr => new Date(mr.mergedAt) >= threeMonthsAgo)
  const byWeek = {}
  for (const mr of recentMrs) {
    const week = getISOWeek(mr.mergedAt)
    if (!byWeek[week]) byWeek[week] = []
    byWeek[week].push(draftMaturityScore(mr.commitCount, mr.commentCount))
  }

  const weeks = Object.keys(byWeek).sort()
  const avgs = weeks.map(w => {
    const vals = byWeek[w]
    return +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(2)
  })

  return {
    labels: weeks,
    datasets: [{
      label: 'Draft Maturity',
      data: avgs,
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      borderWidth: 2
    }]
  }
})

const readinessTrendOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label(ctx) { return `Score: ${Math.round(ctx.parsed.y * 100)}%` }
      }
    }
  },
  scales: {
    x: { ticks: { font: { size: 9 }, color: textColor.value, maxRotation: 45, maxTicksLimit: 8 }, grid: { color: gridColor.value } },
    y: { min: 0, max: 1, ticks: { font: { size: 10 }, color: textColor.value, callback: v => Math.round(v * 100) + '%' }, title: { display: true, text: 'Maturity', font: { size: 10 }, color: textColor.value }, grid: { color: gridColor.value } }
  }
}))

// ─── Graph F: Comments Distribution ───

const commentsDistData = computed(() => {
  const mergedBuckets = {}
  const openBuckets = {}
  for (const mr of activeMrs.value) {
    const c = mr.commentCount || 0
    const bucket = Math.floor(c / 5) * 5
    if (mr.state === 'merged') mergedBuckets[bucket] = (mergedBuckets[bucket] || 0) + 1
    else openBuckets[bucket] = (openBuckets[bucket] || 0) + 1
  }
  const allKeys = new Set([...Object.keys(mergedBuckets), ...Object.keys(openBuckets)].map(Number))
  const max = Math.max(...allKeys, 0)
  const labels = []
  const mergedData = []
  const openData = []
  for (let i = 0; i <= max; i += 5) {
    const upper = i + 4
    labels.push(`${i}-${upper}`)
    mergedData.push(mergedBuckets[i] || 0)
    openData.push(openBuckets[i] || 0)
  }
  return {
    labels,
    datasets: [
      {
        label: 'Open',
        data: openData,
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
        borderColor: '#10b981',
        borderWidth: 1,
        stack: 'comments'
      },
      {
        label: 'Merged',
        data: mergedData,
        backgroundColor: 'rgba(99, 102, 241, 0.7)',
        borderColor: '#6366f1',
        borderWidth: 1,
        stack: 'comments'
      }
    ]
  }
})

const commentsDistOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: 'top', labels: { font: { size: 9 }, color: textColor.value, boxWidth: 10 } },
    tooltip: {
      callbacks: {
        label(ctx) { return `${ctx.dataset.label}: ${ctx.parsed.y} MR${ctx.parsed.y !== 1 ? 's' : ''}` }
      }
    }
  },
  scales: {
    x: { stacked: true, title: { display: true, text: 'Comments', font: { size: 10 }, color: textColor.value }, ticks: { font: { size: 9 }, color: textColor.value }, grid: { color: gridColor.value } },
    y: { stacked: true, beginAtZero: true, ticks: { font: { size: 10 }, color: textColor.value, precision: 0 }, title: { display: true, text: 'MRs', font: { size: 10 }, color: textColor.value }, grid: { color: gridColor.value } }
  }
}))

// ─── Graph G: Time-to-First-Review ───

const noReviewMrs = computed(() => activeMrs.value.filter(mr => !mr.firstReviewAt))

const reviewTimeData = computed(() => {
  const buckets = { '<4h': 0, '4-12h': 0, '12-24h': 0, '1-3d': 0, '3d+': 0 }
  let noReview = 0
  for (const mr of activeMrs.value) {
    if (!mr.firstReviewAt) { noReview++; continue }
    const hours = (new Date(mr.firstReviewAt) - new Date(mr.createdAt)) / (1000 * 60 * 60)
    if (hours < 4) buckets['<4h']++
    else if (hours < 12) buckets['4-12h']++
    else if (hours < 24) buckets['12-24h']++
    else if (hours < 72) buckets['1-3d']++
    else buckets['3d+']++
  }
  const labels = [...Object.keys(buckets), '...', '∞']
  const data = [...Object.values(buckets), 0, noReview]
  const barColor = 'rgba(148, 163, 184, 0.7)'
  const borderClr = '#94a3b8'
  return {
    labels,
    datasets: [{
      label: 'MRs',
      data,
      backgroundColor: data.map((_, i) => i === labels.length - 1 ? 'rgba(251, 146, 60, 0.5)' : barColor),
      borderColor: data.map((_, i) => i === labels.length - 1 ? '#fb923c' : borderClr),
      borderWidth: 1
    }]
  }
})

function onReviewTimeClick(event, elements, chart) {
  if (!elements.length) { noReviewPopover.value = null; return }
  const idx = elements[0].index
  const label = chart.data.labels[idx]
  if (label !== '∞' || noReviewMrs.value.length === 0) { noReviewPopover.value = null; return }
  const rect = chart.canvas.getBoundingClientRect()
  noReviewPopover.value = { x: event.x - rect.left, y: event.y - rect.top }
}

function onReviewTimeHover(event, elements, chart) {
  const canvas = chart.canvas
  if (!elements.length) { canvas.style.cursor = 'default'; return }
  const label = chart.data.labels[elements[0].index]
  canvas.style.cursor = label === '∞' && noReviewMrs.value.length > 0 ? 'pointer' : 'default'
}

const reviewTimeOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  onClick: onReviewTimeClick,
  onHover: onReviewTimeHover,
  plugins: {
    legend: { display: false },
    tooltip: {
      filter(item) { return item.label !== '...' },
      callbacks: {
        title(items) {
          if (!items.length) return ''
          if (items[0].label === '∞') {
            const count = noReviewMrs.value.length
            return `No human review yet — click to open ${count} MR${count !== 1 ? 's' : ''}`
          }
          return items[0].label
        },
        label(ctx) { return `${ctx.parsed.y} MR${ctx.parsed.y !== 1 ? 's' : ''}` }
      }
    }
  },
  scales: {
    x: { title: { display: true, text: 'Time to first review', font: { size: 10 }, color: textColor.value }, ticks: { font: { size: 9 }, color: textColor.value }, grid: { color: gridColor.value } },
    y: { beginAtZero: true, ticks: { font: { size: 10 }, color: textColor.value, precision: 0 }, title: { display: true, text: 'MRs', font: { size: 10 }, color: textColor.value }, grid: { color: gridColor.value } }
  }
}))
</script>

<template>
  <div v-if="hasData" class="p-6 pt-0">
    <div class="flex items-center gap-2 mb-4">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Merge Request Quality</h3>
      <span class="text-xs text-gray-400 dark:text-gray-500">{{ activeMrs.length }} AI-Generated MRs ({{ mergedMrs.length }} merged, {{ openMrs.length }} open)</span>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <!-- Graph E: AI Draft Maturity Score -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-center gap-2">
            <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Draft Maturity Score</h4>
            <div class="relative group">
              <svg class="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="absolute left-0 top-6 z-10 hidden group-hover:block w-72 p-3 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
                <p>Composite score (0–100%) estimating how close AI-generated MRs are to merge-ready. 100% = merged as-is; lower scores mean more human rework and review discussion were needed.</p>
                <div class="flex items-center justify-center mt-2 mb-1 font-mono text-[11px]">
                  <span class="italic mr-1">score</span><span class="mr-1">=</span>
                  <span class="inline-flex flex-col items-center">
                    <span class="px-1 leading-tight">1</span>
                    <span class="border-t border-gray-400 dark:border-gray-500 px-1 leading-tight">1 + 0.3·(<i>c</i> − 1) + 0.1·<i>m</i></span>
                  </span>
                </div>
                <p class="text-[10px] text-gray-400 dark:text-gray-500 text-center"><i>c</i> = commits, <i>m</i> = comments</p>
              </div>
            </div>
          </div>
          <span v-if="overallMaturity !== null" class="text-lg font-bold" :class="overallMaturity >= 0.7 ? 'text-green-600 dark:text-green-400' : overallMaturity >= 0.4 ? 'text-yellow-600 dark:text-yellow-400' : 'text-orange-500 dark:text-orange-400'">{{ Math.round(overallMaturity * 100) }}%</span>
        </div>
        <div class="text-[10px] text-gray-400 dark:text-gray-500 mb-3">weekly avg, last 3 months</div>
        <div class="h-[160px]">
          <Line :data="readinessTrendData" :options="readinessTrendOptions" />
        </div>
      </div>

      <!-- Graph D: Commits Distribution -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-center gap-2">
            <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Commits per MR</h4>
            <div class="relative group">
              <svg class="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="absolute left-0 top-6 z-10 hidden group-hover:block w-56 p-3 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
                Distribution of total commits on merged and open MRs. Lower counts suggest AI output required less rework.
              </div>
            </div>
          </div>
        </div>
        <div class="text-[10px] text-gray-400 dark:text-gray-500 mb-3">distribution across AI-Generated MRs</div>
        <div class="h-[160px]">
          <Bar :data="commitsDistData" :options="commitsDistOptions" />
        </div>
      </div>

      <!-- Graph F: Comments Distribution -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-center gap-2">
            <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Comments per MR</h4>
            <div class="relative group">
              <svg class="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="absolute right-0 top-6 z-10 hidden group-hover:block w-56 p-3 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
                Distribution of review comments on merged and open MRs. Each comment represents reviewer feedback on AI-generated documentation.
              </div>
            </div>
          </div>
        </div>
        <div class="text-[10px] text-gray-400 dark:text-gray-500 mb-3">distribution across AI-Generated MRs</div>
        <div class="h-[160px]">
          <Bar :data="commentsDistData" :options="commentsDistOptions" />
        </div>
      </div>

      <!-- Graph G: Time-to-First-Review -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-center gap-2">
            <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Time to First Review</h4>
            <div class="relative group">
              <svg class="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="absolute right-0 top-6 z-10 hidden group-hover:block w-56 p-3 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
                Time between MR creation and first human reviewer comment.
              </div>
            </div>
          </div>
        </div>
        <div class="text-[10px] text-gray-400 dark:text-gray-500 mb-3">hours/days until first comment</div>
        <div class="h-[160px] relative" @click.self="noReviewPopover = null">
          <Bar :data="reviewTimeData" :options="reviewTimeOptions" />
          <div
            v-if="noReviewPopover"
            class="no-review-popover absolute z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50 p-2 min-w-[200px]"
            :style="{ right: '0px', bottom: '8px' }"
          >
            <div class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5 px-1">No human review yet</div>
            <a
              v-for="mr in noReviewMrs"
              :key="mr.iid"
              :href="mr.webUrl"
              target="_blank"
              rel="noopener"
              class="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-xs text-primary-600 dark:text-blue-400 hover:underline"
              @click="noReviewPopover = null"
            >
              <span class="font-mono">!{{ mr.iid }}</span>
              <span class="text-gray-600 dark:text-gray-400 truncate">{{ mr.title.slice(0, 40) }}{{ mr.title.length > 40 ? '...' : '' }}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
