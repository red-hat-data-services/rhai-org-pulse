<script setup>
import { onMounted, inject, computed, ref, watch, nextTick } from 'vue'
import { useFeatureDetail } from '../execute/composables/useFeatureTraffic'
import { useAIReview } from '../execute/composables/useAIReview.js'
import { useModuleLink } from '@shared/client/composables/useModuleLink.js'
import { apiRequest } from '@shared/client/services/api.js'
import StatusBadge from '../execute/components/StatusBadge.vue'
import TrafficMap from '../execute/components/TrafficMap.vue'
import EpicBreakdown from '../execute/components/EpicBreakdown.vue'
import SignoffSection from '../execute/components/SignoffSection.vue'
import AIReviewSection from '../execute/components/AIReviewSection.vue'
import HygieneViolations from '../execute/components/hygiene/HygieneViolations.vue'

const nav = inject('moduleNav')
const { feature, loading, error, loadFeature } = useFeatureDetail()
const { aiReview, aiReviewLoading, aiReviewError, loadAIReview } = useAIReview()
const { navigateTo: crossNavigate } = useModuleLink()

// --- Hygiene ---
const hygieneLoading = ref(false)
const hygieneViolations = ref([])
const hygieneAvailable = ref(true)
const hygieneExpanded = ref(false)

async function loadHygiene(version) {
  if (!version) { hygieneAvailable.value = false; return }
  hygieneLoading.value = true
  try {
    const data = await apiRequest(`/modules/releases/hygiene/features?version=${encodeURIComponent(version)}`)
    const featureResult = data?.features?.[featureKey.value]
    if (featureResult) {
      hygieneViolations.value = featureResult.violations || []
      hygieneAvailable.value = true
      // Default expanded if there are violations
      hygieneExpanded.value = hygieneViolations.value.length > 0
    } else {
      hygieneViolations.value = []
      hygieneAvailable.value = true
      hygieneExpanded.value = false
    }
  } catch {
    hygieneAvailable.value = false
  } finally {
    hygieneLoading.value = false
  }
}

const hygieneCount = computed(() => hygieneViolations.value.length)

const JIRA_BASE = 'https://redhat.atlassian.net/browse/'

/** Set `true` to show the Delivery Pipeline (`TrafficMap`) section again. */
const SHOW_DELIVERY_PIPELINE = false

// Render ADF (Atlassian Document Format) to HTML
function renderAdf(node) {
  if (!node) return ''
  if (typeof node === 'string') return escHtml(node)

  if (node.type === 'text') {
    let html = escHtml(node.text || '')
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'strong') html = `<strong>${html}</strong>`
        else if (mark.type === 'em') html = `<em>${html}</em>`
        else if (mark.type === 'underline') html = `<u>${html}</u>`
        else if (mark.type === 'code') html = `<code class="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs font-mono">${html}</code>`
        else if (mark.type === 'link' && mark.attrs?.href && isSafeUrl(mark.attrs.href)) html = `<a href="${escAttr(mark.attrs.href)}" target="_blank" class="text-primary-600 dark:text-blue-400 hover:underline">${html}</a>`
        else if (mark.type === 'textColor') {
          const c = (mark.attrs?.color || '').replace(/[^a-zA-Z0-9#(),.\s%]/g, '')
          html = `<span style="color:${escAttr(c)}">${html}</span>`
        }
      }
    }
    return html
  }

  const children = (node.content || []).map(renderAdf).join('')

  switch (node.type) {
    case 'doc': return children
    case 'paragraph': return `<p class="mb-1 last:mb-0">${children || '&nbsp;'}</p>`
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 3))
      const cls = level <= 2 ? 'text-base font-semibold mb-1' : 'text-sm font-semibold mb-1'
      return `<h${level} class="${cls}">${children}</h${level}>`
    }
    // NOTE: list-inside + block children (e.g. <p>) can render the bullet on its own line.
    case 'bulletList': return `<ul class="list-disc list-outside pl-5 mb-2 space-y-0.5">${children}</ul>`
    case 'listItem': return `<li class="[&>p]:inline [&>p]:m-0">${children}</li>`
    case 'hardBreak': return '<br/>'
    case 'emoji': return escHtml(node.attrs?.text || node.attrs?.shortName || '')
    case 'mention': return `<span class="text-primary-600 dark:text-blue-400 font-medium">@${escHtml(node.attrs?.text || node.attrs?.id || '')}</span>`
    case 'date': {
      const ts = node.attrs?.timestamp
      if (ts) { try { return new Date(Number(ts)).toLocaleDateString() } catch { return escHtml(String(ts)) } }
      return ''
    }
    case 'inlineCard': {
      const url = node.attrs?.url || ''
      const label = url.includes('/browse/') ? url.split('/browse/')[1] : url
      return url && isSafeUrl(url) ? `<a href="${escAttr(url)}" target="_blank" class="text-primary-600 dark:text-blue-400 hover:underline">${escHtml(label)}</a>` : escHtml(label)
    }
    default: return children
  }
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
function escAttr(s) {
  return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
function isSafeUrl(url) {
  try { return ['http:', 'https:', 'mailto:'].includes(new URL(url).protocol) }
  catch { return false }
}

function renderStatusNotes(notes) {
  if (!notes) return ''
  if (typeof notes === 'string') return escHtml(notes)
  if (typeof notes === 'object' && notes.type === 'doc') return renderAdf(notes)
  return escHtml(String(notes))
}

const ownerStatusColor = computed(() => feature.value?.ownerStatusColor || null)

const sourceRfeKey = computed(() => aiReview.value?.latest?.sourceRfe || null)

const featureKey = computed(() => nav.params.value.key)

const validationErrors = computed(() => feature.value?.topology?.validationErrors || [])

const unknownFeatureComponents = computed(
  () => feature.value?.topology?.unknownFeatureComponents || []
)

const deliveryIntegration = computed(() => feature.value?.topology?.integration || null)

const hasDeliveryInsight = computed(() => {
  const t = feature.value?.topology?.integration
  if (!t) return false
  if (t.dashboardConsumesBackend || t.notebookIntegration) return true
  return Array.isArray(t.stages) && t.stages.length > 0
})

const fromRfe = computed(() => nav.params.value.fromRfe)
const fromFeatureReview = computed(() => nav.params.value.fromFeatureReview)
const fromPlan = computed(() => nav.params.value.from === 'plan')
const fromFeatureStatus = computed(() => nav.params.value.from === 'feature-status')
const fromHygieneReport = computed(() => nav.params.value.from === 'hygiene-report')

function goBack() {
  if (fromRfe.value) {
    crossNavigate('ai-impact', 'rfe-review', { select: fromRfe.value })
  } else if (fromFeatureReview.value) {
    crossNavigate('ai-impact', 'feature-review')
  } else if (fromPlan.value) {
    nav.navigateTo('plan')
  } else if (fromHygieneReport.value) {
    const params = { report: 'program-hygiene' }
    if (nav.params.value.product) params.product = nav.params.value.product
    if (nav.params.value.version) params.version = nav.params.value.version
    nav.navigateTo('reports', params)
  } else if (fromFeatureStatus.value) {
    const params = { tab: 'feature-status' }
    if (nav.params.value.version) params.version = nav.params.value.version
    if (nav.params.value.product) params.product = nav.params.value.product
    nav.navigateTo('execute', params)
  } else {
    nav.navigateTo('execute')
  }
}

const trafficSignals = computed(() => feature.value?.trafficSignals || null)

const signoffValidation = computed(() => feature.value?.signoffValidation ?? null)

function formatSignalTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function issueHref(key) {
  return key ? JIRA_BASE + key : '#'
}

/** Split text so PROJECT-123 tokens become link parts (Jira keys). */
function splitIssueLinkParts(text) {
  const s = String(text ?? '')
  const re = /\b([A-Z][A-Z0-9]+-\d+)\b/g
  const parts = []
  let last = 0
  let m
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) parts.push({ kind: 'text', text: s.slice(last, m.index) })
    parts.push({ kind: 'key', key: m[1] })
    last = m.index + m[0].length
  }
  if (last < s.length) parts.push({ kind: 'text', text: s.slice(last) })
  return parts.length ? parts : [{ kind: 'text', text: s }]
}

function trafficIssueChipClass(variant) {
  const map = {
    blocker:
      'border-red-300/70 dark:border-red-500/35 text-red-800 dark:text-red-300 bg-white/90 dark:bg-red-950/40 hover:bg-red-100/80 dark:hover:bg-red-900/50',
    warning:
      'border-amber-300/70 dark:border-amber-500/35 text-amber-900 dark:text-amber-200 bg-white/90 dark:bg-amber-950/30 hover:bg-amber-100/80 dark:hover:bg-amber-900/40',
    flowing:
      'border-green-300/70 dark:border-green-500/35 text-green-900 dark:text-green-200 bg-white/90 dark:bg-green-950/30 hover:bg-green-100/80 dark:hover:bg-green-900/40'
  }
  return map[variant] || map.warning
}

/** Matches feature-traffic `compute-metrics` / `traffic-signals` stale rule (7 days, status category In Progress). */
const STALE_ISSUE_DAYS = 7

function computeStaleIssueKeysFromFeature(feat) {
  if (!feat?.epics) return []
  const now = Date.now()
  const keys = []
  for (const epic of feat.epics) {
    for (const issue of epic.issues || []) {
      if (issue.statusCategory !== 'In Progress') continue
      const t = new Date(issue.updated).getTime()
      if (Number.isNaN(t)) continue
      const days = (now - t) / (1000 * 60 * 60 * 24)
      if (days > STALE_ISSUE_DAYS) keys.push(issue.key)
    }
  }
  return [...new Set(keys.filter(Boolean))]
}

const STALE_SIGNAL_TITLE_RE = /^\d+\s+stale in-progress issue/i

/**
 * Prefer `issueKeys` from JSON. Older artifacts may list stale counts with an empty `issueKeys` array;
 * derive keys from the embedded epic/issue tree so Jira links still render.
 */
function signalIssueKeys(item) {
  const raw = item.issueKeys
  if (Array.isArray(raw) && raw.length > 0) return raw
  if (STALE_SIGNAL_TITLE_RE.test(String(item.title || ''))) {
    return computeStaleIssueKeysFromFeature(feature.value)
  }
  return []
}

const metricsData = computed(() => {
  const m = feature.value?.metrics
  if (!m) return null
  const byCategory = m.issuesByCategory || {}
  return {
    totalEpics: m.totalEpics || 0,
    totalIssues: m.totalIssues || 0,
    done: byCategory['Done'] || 0,
    inProgress: byCategory['In Progress'] || 0,
    backlog: byCategory['To Do'] || 0,
    blockers: m.blockerCount || 0,
    stale: m.staleCount || 0,
    storyPoints: m.totalStoryPoints || 0,
    storyPointsDone: m.storyPointsDone || 0,
    completionPct: m.completionPct || 0,
    health: m.health || 'YELLOW'
  }
})

function donutArc(cx, cy, r, startAngle, endAngle) {
  if (endAngle - startAngle >= 2 * Math.PI) {
    return `M ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy}`
  }
  const x1 = cx + r * Math.cos(startAngle)
  const y1 = cy + r * Math.sin(startAngle)
  const x2 = cx + r * Math.cos(endAngle)
  const y2 = cy + r * Math.sin(endAngle)
  const large = endAngle - startAngle > Math.PI ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
}

function ageDays(isoDate) {
  if (!isoDate) return null
  return Math.floor((new Date() - new Date(isoDate)) / (1000 * 60 * 60 * 24))
}

function formatDate(iso) {
  if (!iso) return 'N/A'
  return new Date(iso).toLocaleDateString()
}

// --- Tabs ---
const activeTab = ref('ai-review')
const tabActivated = ref({ 'ai-review': true, 'traffic-signals': false, epics: false, 'source-code': false })

const TAB_ICONS = {
  'traffic-signals': '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />',
  'ai-review': '<path stroke-linecap="round" stroke-linejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 01-1.59.659H9.06a2.25 2.25 0 01-1.591-.659L5 14.5m14 0V5a2 2 0 00-2-2H7a2 2 0 00-2 2v9.5" />',
  epics: '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />',
  'source-code': '<path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />',
}

const visibleTabs = computed(() => {
  const tabs = [
    { id: 'ai-review', label: 'AI Review', icon: TAB_ICONS['ai-review'] },
    { id: 'traffic-signals', label: 'Traffic Signals', icon: TAB_ICONS['traffic-signals'] },
    { id: 'epics', label: 'Epics', icon: TAB_ICONS.epics },
    { id: 'source-code', label: 'Source Code', icon: TAB_ICONS['source-code'] },
  ]
  return tabs
})

const VALID_TABS = ['traffic-signals', 'ai-review', 'epics', 'source-code']
let updatingFromUrl = false

watch(activeTab, (tab) => {
  tabActivated.value[tab] = true
  if (!updatingFromUrl) {
    nav.updateParams({ tab: tab === 'ai-review' ? undefined : tab })
  }
})

watch(() => nav.params.value?.tab, (tabParam) => {
  const tab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'ai-review'
  if (activeTab.value !== tab) {
    updatingFromUrl = true
    activeTab.value = tab
    nextTick(() => { updatingFromUrl = false })
  }
}, { immediate: true })

// Load hygiene when feature data becomes available
// Prefer the version URL param (matches hygiene storage key), fall back to fixVersions
watch(feature, (feat) => {
  const versionParam = nav.params.value?.version
  const version = versionParam || (feat?.fixVersions?.length ? feat.fixVersions[0] : null)
  if (version) {
    loadHygiene(version)
  } else if (feat) {
    hygieneAvailable.value = false
  }
})

onMounted(() => {
  if (featureKey.value) {
    loadFeature(featureKey.value)
    loadAIReview(featureKey.value)
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Back button -->
    <button
      class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1"
      @click="goBack"
    >
      &larr; {{ fromRfe ? 'Back to RFE Review' : fromFeatureReview ? 'Back to Feature Review' : fromPlan ? 'Back to Plan' : fromHygieneReport ? 'Back to Hygiene Report' : fromFeatureStatus ? 'Back to Feature Status' : 'Back to Execute' }}
    </button>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-gray-500">
      Loading feature details...
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-4 text-red-700 dark:text-red-400 text-sm">
      {{ error }}
    </div>

    <!-- Feature detail -->
    <template v-else-if="feature">
      <!-- Header -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2 flex-wrap">
              <a
                :href="JIRA_BASE + feature.key"
                class="text-primary-600 dark:text-blue-400 hover:underline font-mono text-sm"
                target="_blank"
              >{{ feature.key }}</a>
              <StatusBadge :status="feature.status" />
              <StatusBadge v-if="ownerStatusColor" :health="ownerStatusColor">{{ ownerStatusColor }}</StatusBadge>
              <StatusBadge v-else status="Status color missing" />
            </div>
            <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ feature.summary }}</h1>
            <div class="flex flex-wrap gap-3 mt-3 text-xs text-gray-500 dark:text-gray-400">
              <span v-if="feature.assignee">Owner: <span class="text-gray-700 dark:text-gray-300">{{ feature.assignee.displayName }}</span></span>
              <span v-if="feature.pm">PM: <span class="text-gray-700 dark:text-gray-300">{{ feature.pm.displayName }}</span></span>
              <span v-if="feature.releaseType">Release type: <span class="text-gray-700 dark:text-gray-300">{{ feature.releaseType }}</span></span>
              <span v-if="sourceRfeKey" class="flex items-center gap-1">
                Source RFE:
                <button
                  class="font-mono text-primary-600 dark:text-blue-400 hover:underline"
                  @click="crossNavigate('ai-impact', 'rfe-review', { select: sourceRfeKey })"
                >{{ sourceRfeKey }}</button>
                <a
                  :href="JIRA_BASE + sourceRfeKey"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Open in Jira"
                >
                  <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </span>
              <span>Created: {{ formatDate(feature.created) }}</span>
              <span>Updated: {{ formatDate(feature.updated) }}</span>
              <span
                v-for="v in (feature.fixVersions || [])"
                :key="v"
                class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              >{{ v }}</span>
            </div>
          </div>
        </div>

        <!-- Status notes banner -->
        <div
          v-if="feature.statusNotes"
          class="mt-4 p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg"
        >
          <div class="text-xs text-blue-700 dark:text-blue-400 font-medium mb-1">Status Notes</div>
          <div class="text-sm text-gray-700 dark:text-gray-300" v-html="renderStatusNotes(feature.statusNotes)"></div>
        </div>

        <!-- Release signoff: summary row in header; full panel expands on click -->
        <SignoffSection v-if="signoffValidation" collapsible :validation="signoffValidation" />
      </div>

      <!-- Hygiene Section (collapsible) -->
      <div
        v-if="hygieneAvailable || hygieneLoading"
        class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <button
          class="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          @click="hygieneExpanded = !hygieneExpanded"
        >
          <div class="flex items-center gap-2">
            <svg
              class="h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform"
              :class="{ 'rotate-90': hygieneExpanded }"
              xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">Hygiene</span>
            <span
              v-if="!hygieneLoading && hygieneCount > 0"
              class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
            >{{ hygieneCount }} violation{{ hygieneCount === 1 ? '' : 's' }}</span>
            <span
              v-else-if="!hygieneLoading && hygieneCount === 0"
              class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
            >All clear</span>
          </div>
        </button>
        <div v-if="hygieneExpanded" class="px-5 pb-4">
          <HygieneViolations :violations="hygieneViolations" :loading="hygieneLoading" />
        </div>
      </div>

      <!-- No hygiene data message -->
      <div
        v-else-if="feature && !hygieneLoading"
        class="text-xs text-gray-400 dark:text-gray-500 italic px-1"
      >
        No hygiene data available
      </div>

      <!-- Progress Summary (always visible above tabs) -->
      <div v-if="feature.status === 'New'" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div class="flex items-center gap-3 text-gray-500 dark:text-gray-400 text-sm">
          <svg class="h-5 w-5 text-gray-400 dark:text-gray-500 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          This feature is in <span class="font-medium text-gray-700 dark:text-gray-300">New</span> status. Progress tracking will appear once work begins.
        </div>
      </div>
      <div v-else-if="metricsData" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div class="flex flex-col md:flex-row items-start md:items-center gap-6">
          <!-- Donut chart -->
          <div class="flex-shrink-0">
            <svg width="130" height="130" viewBox="0 0 130 130">
              <!-- Background ring -->
              <circle cx="65" cy="65" r="48" fill="none" stroke-width="16" class="stroke-gray-200 dark:stroke-gray-700" />
              <!-- Done arc (green) -->
              <path
                v-if="metricsData.done > 0"
                :d="donutArc(65, 65, 48, -Math.PI / 2, -Math.PI / 2 + (metricsData.done / Math.max(metricsData.totalIssues, 1)) * 2 * Math.PI)"
                fill="none" stroke-width="16" stroke-linecap="round"
                class="stroke-green-500"
              />
              <!-- In Progress arc (blue) -->
              <path
                v-if="metricsData.inProgress > 0"
                :d="donutArc(65, 65, 48,
                  -Math.PI / 2 + (metricsData.done / Math.max(metricsData.totalIssues, 1)) * 2 * Math.PI,
                  -Math.PI / 2 + ((metricsData.done + metricsData.inProgress) / Math.max(metricsData.totalIssues, 1)) * 2 * Math.PI)"
                fill="none" stroke-width="16" stroke-linecap="round"
                class="stroke-blue-500"
              />
              <!-- Center text -->
              <text x="65" y="60" text-anchor="middle" class="fill-gray-900 dark:fill-gray-100" font-size="24" font-weight="bold">{{ metricsData.completionPct }}%</text>
              <text x="65" y="78" text-anchor="middle" class="fill-gray-500 dark:fill-gray-400" font-size="10">complete</text>
            </svg>
          </div>

          <!-- Stat cards -->
          <div class="flex-1 flex flex-wrap items-stretch gap-3 w-full">
            <!-- Epics -->
            <div class="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 min-w-[80px] flex flex-col justify-center">
              <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ metricsData.totalEpics }}</div>
              <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-wide">Epics</div>
            </div>

            <!-- Story Points -->
            <div class="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50 min-w-[80px] flex flex-col justify-center">
              <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {{ metricsData.storyPointsDone }}<span class="text-gray-400 dark:text-gray-500 text-lg">/{{ metricsData.storyPoints }}</span>
              </div>
              <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-wide">Story Pts</div>
            </div>

            <!-- Issues group -->
            <div class="flex flex-1 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <!-- Total issues with blockers/stale footer -->
              <div class="flex-1 text-center px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border-r border-gray-200 dark:border-gray-700">
                <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ metricsData.totalIssues }}</div>
                <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-wide">Issues</div>
                <div class="flex items-center justify-center gap-3 mt-1.5 pt-1.5 border-t border-gray-200 dark:border-gray-700">
                  <span class="text-[10px] font-semibold" :class="metricsData.blockers > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'">{{ metricsData.blockers }} <span class="font-normal">blockers</span></span>
                  <span class="text-gray-300 dark:text-gray-600 text-[10px]">&middot;</span>
                  <span class="text-[10px] font-semibold" :class="metricsData.stale > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400 dark:text-gray-500'">{{ metricsData.stale }} <span class="font-normal">stale</span></span>
                </div>
              </div>
              <!-- Done -->
              <div class="flex-1 text-center px-5 py-3 bg-green-50 dark:bg-green-500/10 border-r border-gray-200 dark:border-gray-700 flex flex-col justify-center">
                <div class="text-2xl font-bold text-green-600 dark:text-green-400">{{ metricsData.done }}</div>
                <div class="text-[10px] text-green-600 dark:text-green-400 mt-0.5 uppercase tracking-wide">Done</div>
              </div>
              <!-- Active -->
              <div class="flex-1 text-center px-5 py-3 bg-blue-50 dark:bg-blue-500/10 border-r border-gray-200 dark:border-gray-700 flex flex-col justify-center">
                <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ metricsData.inProgress }}</div>
                <div class="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 uppercase tracking-wide">Active</div>
              </div>
              <!-- Backlog -->
              <div class="flex-1 text-center px-5 py-3 bg-gray-50 dark:bg-gray-900/50 flex flex-col justify-center">
                <div class="text-2xl font-bold text-gray-500 dark:text-gray-400">{{ metricsData.backlog }}</div>
                <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-wide">Backlog</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Days active -->
        <div v-if="feature.created" class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50 text-xs text-gray-500 dark:text-gray-400">
          {{ ageDays(feature.created) }} days active
        </div>
      </div>

      <!-- Tab Bar -->
      <div class="border-b-2 border-gray-200 dark:border-gray-700">
        <nav class="flex gap-8">
          <button
            v-for="tab in visibleTabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            class="flex items-center gap-2 pb-3 pt-1 text-base font-medium border-b-2 -mb-[2px] transition-colors"
            :class="activeTab === tab.id
              ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
          >
            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" v-html="tab.icon"></svg>
            {{ tab.label }}
          </button>
        </nav>
      </div>

      <!-- Tab Panels -->

      <!-- Traffic Signals Tab -->
      <div v-if="tabActivated['traffic-signals']" v-show="activeTab === 'traffic-signals'">
        <div
          v-if="trafficSignals"
          class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div class="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-baseline justify-between gap-2">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Traffic Signals</h2>
            <span
              v-if="trafficSignals.generatedAt"
              class="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums"
            >
              Derived {{ formatSignalTime(trafficSignals.generatedAt) }}
              <span v-if="trafficSignals.source" class="text-gray-400"> · {{ trafficSignals.source }}</span>
            </span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-700">
            <!-- Blockers / risks -->
            <div class="p-4 bg-red-50/80 dark:bg-red-500/5">
              <div class="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold text-sm mb-3">
                <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-200/80 dark:bg-red-900/40 text-xs" aria-hidden="true">!</span>
                Blockers / risks
              </div>
              <ul v-if="(trafficSignals.blockers || []).length" class="space-y-3">
                <li v-for="(item, idx) in trafficSignals.blockers" :key="'b-' + idx" class="space-y-1">
                  <div class="text-sm font-medium text-red-800 dark:text-red-300">
                    <template v-for="(part, pi) in splitIssueLinkParts(item.title)" :key="'bt-' + idx + '-' + pi">
                      <a
                        v-if="part.kind === 'key'"
                        :href="issueHref(part.key)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary-600 dark:text-blue-400 hover:underline font-mono"
                      >{{ part.key }}</a>
                      <span v-else>{{ part.text }}</span>
                    </template>
                  </div>
                  <p class="text-xs text-red-900/80 dark:text-red-200/80 mt-0.5 leading-relaxed">
                    <template v-for="(part, pi) in splitIssueLinkParts(item.detail)" :key="'bd-' + idx + '-' + pi">
                      <a
                        v-if="part.kind === 'key'"
                        :href="issueHref(part.key)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary-600 dark:text-blue-400 hover:underline font-mono"
                      >{{ part.key }}</a>
                      <span v-else>{{ part.text }}</span>
                    </template>
                  </p>
                  <div v-if="signalIssueKeys(item).length" class="flex flex-wrap gap-1 mt-1">
                    <a
                      v-for="ik in signalIssueKeys(item)"
                      :key="ik"
                      :href="issueHref(ik)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono leading-none transition-colors"
                      :class="trafficIssueChipClass('blocker')"
                    >{{ ik }}</a>
                  </div>
                </li>
              </ul>
              <p v-else class="text-xs text-red-600/70 dark:text-red-400/60 italic">No blockers identified from ticket data.</p>
            </div>
            <!-- Warnings -->
            <div class="p-4 bg-amber-50/80 dark:bg-amber-500/5">
              <div class="flex items-center gap-2 text-amber-800 dark:text-amber-400 font-semibold text-sm mb-3">
                <span class="inline-flex h-6 w-6 items-center justify-center rounded bg-amber-200/80 dark:bg-amber-900/40 text-xs" aria-hidden="true">&#9650;</span>
                Warnings
              </div>
              <ul v-if="(trafficSignals.warnings || []).length" class="space-y-3">
                <li v-for="(item, idx) in trafficSignals.warnings" :key="'w-' + idx" class="space-y-1">
                  <div class="text-sm font-medium text-amber-900 dark:text-amber-300">
                    <template v-for="(part, pi) in splitIssueLinkParts(item.title)" :key="'wt-' + idx + '-' + pi">
                      <a
                        v-if="part.kind === 'key'"
                        :href="issueHref(part.key)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary-600 dark:text-blue-400 hover:underline font-mono"
                      >{{ part.key }}</a>
                      <span v-else>{{ part.text }}</span>
                    </template>
                  </div>
                  <p class="text-xs text-amber-900/80 dark:text-amber-100/80 mt-0.5 leading-relaxed">
                    <template v-for="(part, pi) in splitIssueLinkParts(item.detail)" :key="'wd-' + idx + '-' + pi">
                      <a
                        v-if="part.kind === 'key'"
                        :href="issueHref(part.key)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary-600 dark:text-blue-400 hover:underline font-mono"
                      >{{ part.key }}</a>
                      <span v-else>{{ part.text }}</span>
                    </template>
                  </p>
                  <div v-if="signalIssueKeys(item).length" class="flex flex-wrap gap-1 mt-1">
                    <a
                      v-for="ik in signalIssueKeys(item)"
                      :key="ik"
                      :href="issueHref(ik)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono leading-none transition-colors"
                      :class="trafficIssueChipClass('warning')"
                    >{{ ik }}</a>
                  </div>
                </li>
              </ul>
              <p v-else class="text-xs text-amber-700/70 dark:text-amber-400/60 italic">No warnings identified from ticket data.</p>
            </div>
            <!-- Flowing well -->
            <div class="p-4 bg-green-50/80 dark:bg-green-500/5">
              <div class="flex items-center gap-2 text-green-800 dark:text-green-400 font-semibold text-sm mb-3">
                <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-200/80 dark:bg-green-900/40 text-xs" aria-hidden="true">&#10003;</span>
                Flowing well
              </div>
              <ul v-if="(trafficSignals.flowing || []).length" class="space-y-3">
                <li v-for="(item, idx) in trafficSignals.flowing" :key="'f-' + idx" class="space-y-1">
                  <div class="text-sm font-medium text-green-900 dark:text-green-300">
                    <template v-for="(part, pi) in splitIssueLinkParts(item.title)" :key="'ft-' + idx + '-' + pi">
                      <a
                        v-if="part.kind === 'key'"
                        :href="issueHref(part.key)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary-600 dark:text-blue-400 hover:underline font-mono"
                      >{{ part.key }}</a>
                      <span v-else>{{ part.text }}</span>
                    </template>
                  </div>
                  <p class="text-xs text-green-900/80 dark:text-green-100/80 mt-0.5 leading-relaxed">
                    <template v-for="(part, pi) in splitIssueLinkParts(item.detail)" :key="'fd-' + idx + '-' + pi">
                      <a
                        v-if="part.kind === 'key'"
                        :href="issueHref(part.key)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary-600 dark:text-blue-400 hover:underline font-mono"
                      >{{ part.key }}</a>
                      <span v-else>{{ part.text }}</span>
                    </template>
                  </p>
                  <div v-if="signalIssueKeys(item).length" class="flex flex-wrap gap-1 mt-1">
                    <a
                      v-for="ik in signalIssueKeys(item)"
                      :key="ik"
                      :href="issueHref(ik)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono leading-none transition-colors"
                      :class="trafficIssueChipClass('flowing')"
                    >{{ ik }}</a>
                  </div>
                </li>
              </ul>
              <p v-else class="text-xs text-green-700/70 dark:text-green-400/60 italic">Nothing highlighted yet.</p>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
          No traffic signal data available for this feature.
        </div>
      </div>

      <!-- AI Review Tab -->
      <div v-if="tabActivated['ai-review']" v-show="activeTab === 'ai-review'">
        <AIReviewSection
          :featureReview="aiReview"
          :loading="aiReviewLoading"
          :error="aiReviewError"
        />
      </div>

      <!-- Epics Tab -->
      <div v-if="tabActivated.epics" v-show="activeTab === 'epics'">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Epic Breakdown
          <span class="text-sm font-normal text-gray-500 dark:text-gray-400">({{ (feature.epics || []).length }} epics)</span>
        </h2>
        <EpicBreakdown :epics="feature.epics || []" />
      </div>

      <!-- Source Code Tab -->
      <div v-if="tabActivated['source-code']" v-show="activeTab === 'source-code'" class="space-y-6">
        <!-- Component mismatches -->
        <div
          v-if="validationErrors.length"
          class="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-4"
        >
          <div class="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2">
            Component mismatches
          </div>
          <p class="text-xs text-amber-900/80 dark:text-amber-100/80 mb-2">
            Repositories are derived from the feature's Jira components. These epics reference a component
            not listed on the feature — fix in Jira to ensure correct repo mapping.
          </p>
          <ul class="list-disc list-inside text-sm text-amber-900 dark:text-amber-100 space-y-1">
            <li v-for="(err, idx) in validationErrors" :key="idx">
              <span class="font-mono">{{ err.epicKey }}</span> — <span class="font-medium">{{ err.component }}</span>
            </li>
          </ul>
        </div>

        <!-- Unmapped components -->
        <div
          v-if="unknownFeatureComponents.length"
          class="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-lg p-4"
        >
          <div class="text-sm font-semibold text-rose-800 dark:text-rose-200 mb-1">Unmapped components</div>
          <p class="text-xs text-rose-900/80 dark:text-rose-100/80">
            These Jira components have no known repository mapping. Add them to
            <code class="px-1 rounded bg-rose-100/80 dark:bg-rose-900/40">feature-traffic/context/rhoai-components.yaml</code> or correct the feature in Jira:
          </p>
          <p class="text-sm mt-1 font-mono text-rose-800 dark:text-rose-200">{{ unknownFeatureComponents.join(', ') }}</p>
        </div>

        <!-- Integration view -->
        <div
          v-if="hasDeliveryInsight"
          class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
        >
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Integration patterns</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Inferred from Jira component roles — how the feature's repositories connect.
          </p>
          <ul class="text-sm text-gray-700 dark:text-gray-300 space-y-1 list-disc list-inside">
            <li v-if="deliveryIntegration?.dashboardConsumesBackend">
              Dashboard is treated as consumer of feature backend APIs.
            </li>
            <li v-if="deliveryIntegration?.notebookIntegration">Notebook / workbench integration (parallel to dashboard when applicable).</li>
            <li v-if="deliveryIntegration?.stages?.length">
              Stages: {{ (deliveryIntegration.stages || []).join(' &rarr; ') }}
            </li>
          </ul>
        </div>

        <!-- Traffic map — hidden via SHOW_DELIVERY_PIPELINE; markup kept for easy restore -->
        <div v-if="SHOW_DELIVERY_PIPELINE">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Delivery Pipeline</h2>
          <TrafficMap
            :repos="feature.topology?.repos || []"
            :epics="feature.epics || []"
            :health="feature.metrics?.health || 'YELLOW'"
          />
        </div>

        <!-- Repo breakdown -->
        <div v-if="(feature.topology?.repos || []).length > 0">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Repository Breakdown</h2>
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-200 dark:border-gray-700">
                  <th class="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Repository</th>
                  <th class="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Components</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="repo in feature.topology.repos"
                  :key="repo.url"
                  class="border-b border-gray-100 dark:border-gray-800"
                >
                  <td class="px-4 py-2">
                    <a
                      :href="'https://' + repo.url"
                      class="text-primary-600 dark:text-blue-400 hover:underline text-xs"
                      target="_blank"
                    >{{ repo.url }}</a>
                  </td>
                  <td class="px-4 py-2">
                    <span
                      v-for="c in (repo.components || [])"
                      :key="c"
                      class="inline-block px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs mr-1 mb-1"
                    >{{ c }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Empty state when no source code data -->
        <div
          v-if="!validationErrors.length && !unknownFeatureComponents.length && !hasDeliveryInsight && !(feature.topology?.repos || []).length"
          class="text-center py-12 text-gray-500 dark:text-gray-400 text-sm"
        >
          No repository or component data available for this feature.
        </div>
      </div>
    </template>

    <!-- No feature key -->
    <div v-else class="text-center py-12 text-gray-500">
      No feature key provided. Go back to the overview and select a feature.
    </div>
  </div>
</template>
