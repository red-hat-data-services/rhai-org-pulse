<template>
  <div
    class="rounded-xl border bg-gradient-to-br shadow-[0_1px_3px_rgba(0,0,0,0.06),0_6px_20px_rgba(0,0,0,0.04)] overflow-hidden"
    :class="containerBorder"
  >
    <!-- Accordion header -->
    <button
      class="w-full flex items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50/60 dark:hover:bg-gray-800/40"
      @click="open = !open"
    >
      <div class="flex items-center gap-4 min-w-0 flex-wrap">
        <div class="flex items-center gap-2">
          <span
            class="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100"
          >RHAI {{ group.version }}</span>
          <span
            class="inline-flex h-3 w-3 shrink-0 rounded-full ring-2 ring-white dark:ring-gray-900"
            :class="riskDotClass"
            :title="`Aggregate risk: ${group.risk}`"
          />
        </div>
        <span
          v-if="group.earliestCodeFreeze"
          class="inline-flex items-center gap-1.5 rounded-full border border-pink-200 dark:border-pink-700/50 bg-pink-50 dark:bg-pink-900/30 px-2.5 py-1 text-[11px] font-medium text-pink-700 dark:text-pink-300 shadow-sm"
          @click.stop
        >
          <svg class="h-3.5 w-3.5 text-pink-500 dark:text-pink-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clip-rule="evenodd" /></svg>
          Code Freeze · {{ formatDueDate(group.earliestCodeFreeze) }}
        </span>
        <span
          v-if="group.earliestRelease"
          class="inline-flex items-center gap-1.5 rounded-full border border-purple-200 dark:border-purple-700/50 bg-purple-50 dark:bg-purple-900/30 px-2.5 py-1 text-[11px] font-medium text-purple-700 dark:text-purple-300 shadow-sm"
          @click.stop
        >
          <svg class="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clip-rule="evenodd" /></svg>
          Release · {{ formatDueDate(group.earliestRelease) }}
        </span>
        <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
          {{ group.productCount }} product{{ group.productCount === 1 ? '' : 's' }}
        </span>
        <div class="hidden sm:flex items-center gap-2 flex-wrap">
          <span
            v-for="name in group.productNames"
            :key="name"
            class="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            <span
              class="inline-flex h-1.5 w-1.5 rounded-full"
              :class="productDotClass(productRisk(name))"
            />
            {{ name }}
          </span>
        </div>
      </div>
      <div class="flex items-center gap-5 shrink-0">
        <!-- Aggregated progress mini-bar -->
        <div class="hidden md:flex items-center gap-3">
          <div class="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
            <span class="inline-flex items-center gap-1"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />{{ fmtCount(group.totals.issues_done) }}</span>
            <span class="inline-flex items-center gap-1"><span class="h-1.5 w-1.5 rounded-full bg-blue-500" />{{ fmtCount(group.totals.issues_doing) }}</span>
            <span class="inline-flex items-center gap-1"><span class="h-1.5 w-1.5 rounded-full bg-gray-400" />{{ fmtCount(group.totals.issues_to_do) }}</span>
          </div>
          <div class="w-28 h-2 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 ring-1 ring-inset ring-gray-200/60 dark:ring-gray-700/60">
            <div class="h-full flex">
              <div class="h-full bg-emerald-500 dark:bg-emerald-600" :style="{ width: pct(group.totals.issues_done, totalIssues) }" />
              <div class="h-full bg-blue-500 dark:bg-blue-600" :style="{ width: pct(group.totals.issues_doing, totalIssues) }" />
              <div class="h-full bg-gray-400 dark:bg-gray-500" :style="{ width: pct(group.totals.issues_to_do, totalIssues) }" />
            </div>
          </div>
        </div>
        <span class="text-xs tabular-nums text-gray-500 dark:text-gray-400">
          {{ totalIssues }} issues
        </span>
        <svg
          class="h-4 w-4 text-gray-400 transition-transform duration-200"
          :class="{ 'rotate-180': open }"
          xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
        >
          <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
        </svg>
      </div>
    </button>

    <!-- Expanded content: product release cards -->
    <transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      enter-from-class="opacity-0 max-h-0"
      enter-to-class="opacity-100 max-h-[5000px]"
      leave-from-class="opacity-100 max-h-[5000px]"
      leave-to-class="opacity-0 max-h-0"
    >
      <div v-show="open" class="border-t border-gray-200/60 dark:border-gray-700/60">
        <!-- Aggregated summary row -->
        <div class="px-5 py-3 bg-gray-50/50 dark:bg-gray-800/30 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800">
          <span>
            <span class="font-semibold text-gray-800 dark:text-gray-200">{{ totalIssues }}</span> total issues across
            <span class="font-semibold text-gray-800 dark:text-gray-200">{{ group.releaseCount }}</span> release(s)
          </span>
          <span>
            Earliest due: <span class="font-semibold text-gray-800 dark:text-gray-200">{{ formatDate(group.earliestDue) }}</span>
          </span>
          <span class="inline-flex items-center gap-1.5">
            Completion:
            <span class="font-semibold tabular-nums text-gray-800 dark:text-gray-200">{{ completionPct }}%</span>
            <div class="w-16 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div class="h-full bg-emerald-500 dark:bg-emerald-600 rounded-full" :style="{ width: completionPct + '%' }" />
            </div>
          </span>
        </div>

        <!-- Group-level Monte Carlo forecast -->
        <div v-if="groupForecast" class="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
          <p class="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            Monte Carlo Forecast — all {{ group.releaseCount }} release(s) complete
          </p>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="rounded-lg border px-4 py-3" :class="pCardClass">
              <p class="text-[10px] font-medium uppercase tracking-wider mb-1" :class="pLabelClass">
                Probability at Release
              </p>
              <p class="text-2xl font-bold tabular-nums" :class="pValueClass">{{ groupForecast.pAtDeadline }}%</p>
              <p class="text-[11px] mt-0.5" :class="pSubClass">{{ formatDueDate(group.earliestRelease) }}</p>
            </div>

            <div class="rounded-lg border border-amber-200 dark:border-amber-700/50 bg-amber-50/60 dark:bg-amber-900/20 px-4 py-3">
              <p class="text-[10px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">85% Confidence</p>
              <p class="text-2xl font-bold text-amber-700 dark:text-amber-300 tabular-nums">{{ formatShortDate(groupForecast.p85Date) }}</p>
              <p class="text-[11px] text-amber-500/80 dark:text-amber-500/60 mt-0.5">{{ daysLabel(groupForecast.p85Days) }}</p>
            </div>

            <div class="rounded-lg border border-teal-200 dark:border-teal-700/50 bg-teal-50/60 dark:bg-teal-900/20 px-4 py-3">
              <p class="text-[10px] font-medium uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-1">95% Confidence</p>
              <p class="text-2xl font-bold text-teal-700 dark:text-teal-300 tabular-nums">{{ formatShortDate(groupForecast.p95Date) }}</p>
              <p class="text-[11px] text-teal-500/80 dark:text-teal-500/60 mt-0.5">{{ daysLabel(groupForecast.p95Days) }}</p>
            </div>
          </div>
          <p class="text-[9px] text-gray-400 dark:text-gray-500 mt-2">
            1,000 simulations per release, worst-case per iteration.
            {{ groupForecast.productCount }} release(s) simulated · {{ groupForecast.totalRemaining }} remaining issues.
            <template v-if="groupForecast.redCount || groupForecast.yellowCount">
              Risk-adjusted velocity:
              <template v-if="groupForecast.redCount">{{ groupForecast.redCount }} red (-40%)</template><template v-if="groupForecast.redCount && groupForecast.yellowCount">, </template><template v-if="groupForecast.yellowCount">{{ groupForecast.yellowCount }} yellow (-20%)</template>.
            </template>
          </p>
        </div>

        <!-- Product cards -->
        <div class="p-4 space-y-4">
          <ProductReleaseCard
            v-for="release in group.releases"
            :key="release.releaseNumber"
            :release="release"
            :mc-inputs="mcInputsMap.get(release.releaseNumber) || null"
            :active-mc-target="getMcTarget(release.releaseNumber)"
            @set-mc-target="(rn, target) => $emit('set-mc-target', rn, target)"
          />
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import ProductReleaseCard from './ProductReleaseCard.vue'
import { extractProduct } from '../composables/useReleaseFilter'
import { gammaSample } from '../utils/monteCarlo'

const ITERATIONS = 1000
const MAX_DAYS = 730

const props = defineProps({
  group: { type: Object, required: true },
  mcInputsMap: { type: Map, required: true },
  getMcTarget: { type: Function, required: true },
  defaultOpen: { type: Boolean, default: true }
})

defineEmits(['set-mc-target'])

const open = ref(props.defaultOpen)

const totalIssues = computed(() => {
  const t = props.group.totals
  return (t.issues_to_do || 0) + (t.issues_doing || 0) + (t.issues_done || 0)
})

const completionPct = computed(() => {
  if (!totalIssues.value) return 0
  return Math.round((props.group.totals.issues_done / totalIssues.value) * 100)
})

// ── Monte Carlo simulation (per-product independent, take max per iteration) ──

function getToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d }
function daysBetween(from, to) { return Math.ceil((to - from) / (1000 * 60 * 60 * 24)) }

/**
 * Risk-adjusted velocity discount: at-risk products historically underperform
 * their baseline throughput due to blockers, scope creep, and quality issues.
 */
const RISK_VELOCITY_FACTOR = { red: 0.6, yellow: 0.8, green: 1.0 }

const groupForecast = computed(() => {
  const products = []
  let redCount = 0
  let yellowCount = 0
  for (const r of props.group.releases) {
    const mc = props.mcInputsMap.get(r.releaseNumber)
    if (mc && mc.notDoneCount > 0 && mc.totalVelocity > 0) {
      const risk = r.risk || 'green'
      const factor = RISK_VELOCITY_FACTOR[risk] ?? 1.0
      products.push({
        notDoneCount: mc.notDoneCount,
        velocity: mc.totalVelocity * factor,
        risk
      })
      if (risk === 'red') redCount++
      else if (risk === 'yellow') yellowCount++
    }
  }
  if (!products.length) return null

  const deadline = props.group.earliestRelease
  if (!deadline) return null

  const today = getToday()
  const dueObj = new Date(deadline + 'T00:00:00')
  const daysToDeadline = daysBetween(today, dueObj)

  const groupCompletionDays = new Array(ITERATIONS)
  for (let i = 0; i < ITERATIONS; i++) {
    let maxDays = 0
    for (const p of products) {
      const scale = 14 / p.velocity
      const days = Math.min(Math.ceil(gammaSample(p.notDoneCount, scale)), MAX_DAYS)
      if (days > maxDays) maxDays = days
    }
    groupCompletionDays[i] = maxDays
  }
  groupCompletionDays.sort((a, b) => a - b)

  const completedByDeadline = groupCompletionDays.filter(d => d <= daysToDeadline).length
  const pAtDeadline = Math.round((completedByDeadline / ITERATIONS) * 100)
  const p85Days = groupCompletionDays[Math.ceil(ITERATIONS * 0.85) - 1]
  const p95Days = groupCompletionDays[Math.ceil(ITERATIONS * 0.95) - 1]

  return {
    pAtDeadline,
    p85Days,
    p85Date: addDays(today, p85Days),
    p95Days,
    p95Date: addDays(today, p95Days),
    productCount: products.length,
    totalRemaining: products.reduce((s, p) => s + p.notDoneCount, 0),
    redCount,
    yellowCount
  }
})

const pCardClass = computed(() => {
  if (!groupForecast.value) return ''
  const p = groupForecast.value.pAtDeadline
  if (p >= 70) return 'border-emerald-200 dark:border-emerald-700/50 bg-emerald-50/60 dark:bg-emerald-900/20'
  if (p >= 40) return 'border-amber-200 dark:border-amber-700/50 bg-amber-50/60 dark:bg-amber-900/20'
  return 'border-red-200 dark:border-red-700/50 bg-red-50/60 dark:bg-red-900/20'
})

const pLabelClass = computed(() => {
  if (!groupForecast.value) return ''
  const p = groupForecast.value.pAtDeadline
  if (p >= 70) return 'text-emerald-600 dark:text-emerald-400'
  if (p >= 40) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
})

const pValueClass = computed(() => {
  if (!groupForecast.value) return ''
  const p = groupForecast.value.pAtDeadline
  if (p >= 70) return 'text-emerald-700 dark:text-emerald-300'
  if (p >= 40) return 'text-amber-700 dark:text-amber-300'
  return 'text-red-700 dark:text-red-300'
})

const pSubClass = computed(() => {
  if (!groupForecast.value) return ''
  const p = groupForecast.value.pAtDeadline
  if (p >= 70) return 'text-emerald-500/80 dark:text-emerald-500/60'
  if (p >= 40) return 'text-amber-500/80 dark:text-amber-500/60'
  return 'text-red-500/80 dark:text-red-500/60'
})

// ── Styling helpers ──

const containerBorder = computed(() => {
  const risk = props.group.risk
  if (risk === 'red') return 'border-red-200/80 dark:border-red-800/50 from-red-50/30 to-white dark:from-red-950/10 dark:to-gray-900/40'
  if (risk === 'yellow') return 'border-amber-200/80 dark:border-amber-800/50 from-amber-50/30 to-white dark:from-amber-950/10 dark:to-gray-900/40'
  return 'border-emerald-200/80 dark:border-emerald-800/50 from-emerald-50/20 to-white dark:from-emerald-950/10 dark:to-gray-900/40'
})

const riskDotClass = computed(() => {
  const risk = props.group.risk
  if (risk === 'red') return 'bg-red-500 dark:bg-red-600'
  if (risk === 'yellow') return 'bg-amber-400 dark:bg-amber-500'
  return 'bg-emerald-500 dark:bg-emerald-600'
})

function productRisk(productName) {
  const matching = props.group.releases.filter(
    r => extractProduct(r.releaseNumber) === productName
  )
  if (matching.some(r => r.risk === 'red')) return 'red'
  if (matching.some(r => r.risk === 'yellow')) return 'yellow'
  return 'green'
}

function productDotClass(risk) {
  if (risk === 'red') return 'bg-red-500'
  if (risk === 'yellow') return 'bg-amber-400'
  return 'bg-emerald-500'
}

function pct(part, total) {
  if (!total || part <= 0) return '0%'
  return `${Math.min(100, (part / total) * 100)}%`
}

function fmtCount(n) {
  if (n == null || !Number.isFinite(Number(n))) return '0'
  return String(Math.round(Number(n)))
}

function daysLabel(days) {
  if (days == null) return ''
  if (days <= 0) return 'Today or past'
  if (days === 1) return '1 day from now'
  return `${days} days from now`
}

function formatDate(d) {
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString()
}

function formatShortDate(d) {
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDueDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>
